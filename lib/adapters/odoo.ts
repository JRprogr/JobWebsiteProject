import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Odoo websites with the Recruitment app: <host>/jobs lists job cards (schema.org address inside), <host>/jobs/<slug>-<id> is the listing.
type Card = { id: string; path: string; title: string; location: string | null; department: string | null };

const root = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "host", company.slug)}`;
const strip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseCards(html: string): Card[] {
  return html
    .split('<div class="card ">')
    .slice(1)
    .flatMap((chunk) => {
      const path = /href="(\/jobs\/[^"?#]*?-(\d+))"/.exec(chunk);
      const title = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(chunk)?.[1];
      if (!path || !title) return [];
      const place = ["addressLocality", "addressCountry"].map((p) => new RegExp(`itemprop="${p}">([^<]*)<`).exec(chunk)?.[1]).filter(Boolean);
      const department = /o_job_infos[\s\S]*?<\/address>\s*([\s\S]*?)(?:<\/span>|<\/div>)/.exec(chunk)?.[1];
      return [{ id: path[2], path: path[1], title: strip(title), location: place.map((p) => decodeEntities(p ?? "").trim()).join(", ") || null, department: department ? strip(department) || null : null }];
    });
}

async function fetchText(company: Pick<Company, "slug" | "source_config">, path: string): Promise<string | null> {
  const body = extractElement(await getText(`${root(company)}${path}`), 'itemprop="description"');
  return body ? htmlToText(body) || null : null;
}

export const odooDetail: DetailFetcher = async (company, job) => fetchText(company, new URL(job.url).pathname);

export const odoo: Adapter = async (company, ctx) => {
  const all = new Map<string, Card>();
  for (let page = 1; page <= 10; page++) {
    const cards = parseCards(await getText(`${root(company)}/jobs${page > 1 ? `/page/${page}` : ""}`).catch(() => ""));
    const fresh = cards.filter((c) => !all.has(c.id));
    for (const c of fresh) all.set(c.id, c);
    if (fresh.length === 0) break;
  }
  const list = [...all.values()].filter((c) => !isEvergreen(c.title));
  const hint = defaultCountry(company.source_config);

  const targets = list.filter((c) => !ctx.known.has(c.id)).slice(0, ctx.backfill ? 300 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (c) => {
    try {
      texts.set(c.id, await fetchText(company, c.path));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return list.map((c): NormalizedJob => ({
    external_id: c.id,
    title: (ctx.known.get(c.id) ?? c.title).trim(),
    location_raw: c.location,
    remote: false,
    department: c.department,
    url: `${root(company)}${c.path}`,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: null,
    country_hint: hint,
    description: texts.has(c.id) ? (texts.get(c.id) ?? "") : null,
  }));
};

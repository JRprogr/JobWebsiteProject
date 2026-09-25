import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, htmlToText, parseJsonLd } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Clinch Talent career sites (Redwire): server-rendered result cards at <base>/jobs/search?page=N (10 per page); every job page
// carries schema.org JobPosting JSON-LD with the description and posting date.
type Card = { id: string; url: string; title: string; location: string | null; department: string | null; remote: boolean };

const base = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "base", company.slug).replace(/\/$/, "");
const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseCards(html: string): Card[] {
  return html
    .split("job-search-results-card-col")
    .slice(1)
    .flatMap((chunk): Card[] => {
      const link = /<a id="link_job_title[^"]*" href="([^"]+)">([\s\S]*?)<\/a>/.exec(chunk);
      if (!link) return [];
      const field = (name: string) => {
        const m = new RegExp(`job-component-${name}[\\s\\S]*?<span[^>]*>([\\s\\S]*?)</span>`).exec(chunk);
        return m ? clean(m[1]) || null : null;
      };
      const url = decodeEntities(link[1]);
      return [
        {
          id: field("requisition-identifier") ?? url.split("/").pop() ?? url,
          url,
          title: clean(link[2]),
          location: field("location"),
          department: field("department") ?? field("category"),
          remote: /remote/i.test(field("workplace-type") ?? ""),
        },
      ];
    });
}

async function list(company: Company): Promise<Card[]> {
  const cards = new Map<string, Card>();
  for (let page = 1; page <= 40; page++) {
    let html = await getText(`${base(company)}/jobs/search?page=${page}`);
    for (let retry = 0; html.length < 2000 && retry < 3; retry++) {
      await sleep(2000);
      html = await getText(`${base(company)}/jobs/search?page=${page}`);
    }
    const found = parseCards(html);
    const fresh = found.filter((c) => !cards.has(c.id));
    for (const c of fresh) cards.set(c.id, c);
    if (fresh.length === 0) break;
    await sleep(100);
  }
  return [...cards.values()];
}

async function posting(url: string): Promise<{ text: string | null; posted: string | null }> {
  // the site now and then answers with an empty page under load; one retry is enough
  let html = await getText(url);
  if (html.length < 2000) {
    await sleep(1500);
    html = await getText(url);
  }
  for (const m of html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = parseJsonLd(m[1]) as { "@type"?: string; description?: string; datePosted?: string };
      if (j["@type"] === "JobPosting") {
        const t = j.datePosted ? Date.parse(j.datePosted) : NaN;
        return { text: j.description ? htmlToText(j.description) || null : null, posted: Number.isNaN(t) ? null : new Date(t).toISOString() };
      }
    } catch {
      // not the JSON-LD we want
    }
  }
  return { text: null, posted: null };
}

export const clinchDetail: DetailFetcher = async (_company, job) => (await posting(job.url)).text;

export const clinch: Adapter = async (company, ctx) => {
  const hint = defaultCountry(company.source_config);
  const cards = (await list(company)).filter((c) => !isEvergreen(c.title));

  const targets = cards.filter((c) => !ctx.known.has(c.id)).slice(0, ctx.backfill ? 300 : 30);
  const found = new Map<string, { text: string | null; posted: string | null }>();
  await mapPool(targets, 3, async (c) => {
    try {
      found.set(c.id, await posting(c.url));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return cards.map((c): NormalizedJob => {
    const p = found.get(c.id);
    return {
      external_id: c.id,
      title: (ctx.known.get(c.id) ?? c.title).trim(),
      location_raw: c.location,
      remote: c.remote,
      department: c.department,
      url: c.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: p?.posted ?? null,
      country_hint: hint,
      description: p ? (p.text ?? "") : null,
    };
  });
};

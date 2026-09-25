import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// KONGSBERG's own vacancies page (kongsberg.com/careers/vacancies/?department=...) is server-rendered with the department filter
// from the URL, and every vacancy has its own page under /careers/vacancies/<slug>/. (The Easycruit ATS behind it sits behind a
// bot check, so this is used instead.) Used as the custom kind "kongsberg-web".
type Row = { slug: string; title: string; location: string | null };

const ROOT = "https://www.kongsberg.com";

const text = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseList(html: string): Row[] {
  return [...html.matchAll(/<li><a href="\/careers\/vacancies\/([^"/]+)\/" class="LinkArrowBlockList__itemLink">([\s\S]*?)<\/a><\/li>/g)].flatMap((m): Row[] => {
    const title = /LinkArrowBlockList__itemTitle">([\s\S]*?)<\/span>/.exec(m[2])?.[1];
    if (!title) return [];
    const where = /<address[\s\S]*?<\/address>/.exec(m[2])?.[0];
    // "Location: Kongsberg Defence & Aerospace, Kongsberg": the business unit comes first and is not a place
    const place = where ? text(where).replace(/^Location:\s*/i, "").replace(/^Kongsberg\s+[^,]+,\s*/, "") : "";
    return [{ slug: m[1], title: text(title), location: place || null }];
  });
}

async function vacancyText(slug: string): Promise<string | null> {
  const html = await getText(`${ROOT}/careers/vacancies/${slug}/`);
  const body = extractElement(html, 'class="VacancyPage"');
  return body ? htmlToText(body) || null : null;
}

export const kongsbergDetail: DetailFetcher = async (_company, job) => vacancyText(job.external_id);

export const kongsberg: Adapter = async (company, ctx) => {
  const hint = defaultCountry(company.source_config);
  const rows = parseList(await getText(configString(company.source_config, "list_url", company.slug))).filter((r) => !isEvergreen(r.title));

  const targets = rows.filter((r) => !ctx.known.has(r.slug)).slice(0, ctx.backfill ? 300 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (r) => {
    try {
      texts.set(r.slug, await vacancyText(r.slug));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return rows.map((r): NormalizedJob => ({
    external_id: r.slug,
    title: (ctx.known.get(r.slug) ?? r.title).trim(),
    location_raw: r.location,
    remote: false,
    department: null,
    url: `${ROOT}/careers/vacancies/${r.slug}/`,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: null,
    country_hint: hint,
    description: texts.has(r.slug) ? (texts.get(r.slug) ?? "") : null,
  }));
};

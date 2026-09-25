import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, htmlToText, parseJsonLd } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Radancy TalentBrew career sites (Boeing). The search page loads its results from <base>/search-jobs/results as JSON whose
// `results` field is an HTML list; each job page carries schema.org JobPosting JSON-LD with the full description.
// source_config: { base, keywords?, organization_ids?, default_country? }
type Row = { id: string; path: string; title: string; location: string | null; date: string | null };

const cfg = (company: Pick<Company, "slug" | "source_config">) => ({
  base: configString(company.source_config, "base", company.slug).replace(/\/$/, ""),
  keywords: typeof company.source_config.keywords === "string" ? company.source_config.keywords : "",
  org: typeof company.source_config.organization_ids === "string" ? company.source_config.organization_ids : "",
});

const PER_PAGE = 15;

function url(company: Pick<Company, "slug" | "source_config">, page: number): string {
  const { base, keywords, org } = cfg(company);
  const q = new URLSearchParams({
    ActiveFacetID: "0", CurrentPage: String(page), RecordsPerPage: String(PER_PAGE), TotalContentResults: "", Distance: "50", RadiusUnitType: "0",
    Keywords: keywords, Location: "", ShowRadius: "False", IsPagination: "False", CustomFacetName: "", FacetTerm: "", FacetType: "0",
    SearchResultsModuleName: "Search Results", SearchFiltersModuleName: "Search Filters", SortCriteria: "0", SortDirection: "0", SearchType: "5",
    PostalCode: "", fc: "", fl: "", fcf: "", afc: "", afl: "", afcf: "", TotalContentPages: "NaN", OrganizationIds: org,
  });
  return `${base}/search-jobs/results?${q}`;
}

export function parseResults(html: string): Row[] {
  return [...html.matchAll(/<li[^>]*>\s*<a class="search-results__job-link" href="([^"]+)" data-job-id="(\d+)"><span class="search-results__job-title">([\s\S]*?)<\/span><\/a>([\s\S]*?)<\/li>/g)].map((m) => ({
    id: m[2],
    path: decodeEntities(m[1]),
    title: decodeEntities(m[3].replace(/<[^>]+>/g, "")).trim(),
    // "El Segundo, California; and other locations": the trailer is not a place
    location: decodeEntities(/job-info location">([\s\S]*?)<\/span>/.exec(m[4])?.[1] ?? "").replace(/;?\s*and other locations$/i, "").trim() || null,
    date: /job-info date">([^<]*)</.exec(m[4])?.[1]?.trim() ?? null,
  }));
}

async function list(company: Company): Promise<Row[]> {
  const rows = new Map<string, Row>();
  for (let page = 1; page <= 120; page++) {
    const res = JSON.parse(await getText(url(company, page))) as { results?: string };
    const found = parseResults(res.results ?? "");
    const fresh = found.filter((r) => !rows.has(r.id));
    for (const r of fresh) rows.set(r.id, r);
    if (fresh.length === 0 || found.length < PER_PAGE) break;
    await sleep(80);
  }
  return [...rows.values()];
}

async function fetchPosting(company: Pick<Company, "slug" | "source_config">, path: string): Promise<{ text: string | null; posted: string | null }> {
  const html = await getText(`${cfg(company).base}${path}`);
  for (const m of html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = parseJsonLd(m[1]) as { "@type"?: string; description?: string; datePosted?: string };
      if (j["@type"] === "JobPosting") {
        const d = j.datePosted ? Date.parse(j.datePosted.replace(/-(\d)(?=-|$)/g, "-0$1")) : NaN;
        return { text: j.description ? htmlToText(j.description) || null : null, posted: Number.isNaN(d) ? null : new Date(d).toISOString() };
      }
    } catch {
      // not the JSON-LD we want
    }
  }
  return { text: null, posted: null };
}

export const talentbrewDetail: DetailFetcher = async (company, job) => fetchPosting(company, new URL(job.url).pathname).then((p) => p.text);

const parseDate = (s: string | null) => {
  const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))).toISOString() : null;
};

export const talentbrew: Adapter = async (company, ctx) => {
  const { base } = cfg(company);
  const hint = defaultCountry(company.source_config);
  const rows = (await list(company)).filter((r) => !isEvergreen(r.title));

  const targets = rows.filter((r) => !ctx.known.has(r.id)).slice(0, ctx.backfill ? 650 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (r) => {
    try {
      texts.set(r.id, (await fetchPosting(company, r.path)).text);
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return rows.map((r): NormalizedJob => ({
    external_id: r.id,
    title: (ctx.known.get(r.id) ?? r.title).trim(),
    location_raw: r.location,
    remote: /\bremote\b/i.test(r.location ?? ""),
    department: null,
    url: `${base}${r.path}`,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: parseDate(r.date),
    country_hint: hint,
    description: texts.has(r.id) ? (texts.get(r.id) ?? "") : null,
  }));
};

import { politeFetch } from "./http.ts";
import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import type { Adapter, AdapterContext, Company, DetailFetcher, NormalizedJob } from "../types.ts";

const PAGE_SIZE = 20; // Workday's CXS API rejects a larger limit (HTTP 400)

type Config = {
  tenant: string;
  host: string;
  site: string;
  hiringCompanyIds?: string[];
  searchText: string;
  excludeLocations?: RegExp;
  bulletMatch?: RegExp;
};

function cfg(company: { slug: string; source_config: Record<string, unknown> }): Config {
  const { tenant, host, site } = company.source_config;
  if (typeof tenant !== "string" || typeof host !== "string" || typeof site !== "string") {
    throw new Error(`${company.slug}: source_config.tenant/host/site missing`);
  }
  const raw = company.source_config.hiring_company_ids;
  const hiringCompanyIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : undefined;
  const rx = (key: string) => (typeof company.source_config[key] === "string" ? new RegExp(company.source_config[key] as string, "i") : undefined);
  const searchText = typeof company.source_config.search_text === "string" ? company.source_config.search_text : "";
  return { tenant, host, site, hiringCompanyIds, searchText, excludeLocations: rx("exclude_locations_regex"), bulletMatch: rx("bullet_match_regex") };
}

// The CXS API (what the Workday careers UI itself calls) is the only public way to list postings; no auth required.
const apiBase = (c: Config) => `https://${c.tenant}.${c.host}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.site}`;
const publicBase = (c: Config) => `https://${c.tenant}.${c.host}.myworkdayjobs.com/${c.site}`;

// bulletFields[0] is always the plain requisition id (e.g. "JR12345678"). The trailing segment of externalPath
// usually matches it too, but Workday appends a disambiguator ("-1", "-2", ...) when two postings share a title
// and location, which breaks a path-only extraction — bulletFields doesn't have that problem.
const reqId = (item: { externalPath: string; bulletFields?: string[] }) =>
  item.bulletFields?.find((b) => /^[A-Za-z]{0,4}-?\d{4,}$/.test(b)) ??
  item.externalPath.match(/_([A-Za-z0-9]+)(?:-\d+)?$/)?.[1] ??
  null;

// Some tenants (RTX) list sites as plant codes, e.g. "DE-HE-FRANKFURT-015 ~ Victor-Slotosch St 15 ~ BLDG 15"
// (country-state-city-site ~ street ~ building). Turn that into "Frankfurt" plus the country code as a hint — a "Frankfurt, DE"
// string would read "DE" as the US state (Delaware).
function tidyLocation(raw: string | null): { raw: string | null; country: string | null } {
  const m = raw?.match(/^([A-Z]{2})-([^~]+?)(?:\s+~.*)?$/);
  if (!m) return { raw, country: null };
  const parts = m[2].split("-");
  // With a state segment the city runs until the first site-code part (one containing a digit, or "BLDG ...")
  const cityParts = parts.length >= 3 ? parts.slice(1).filter((_, i, rest) => rest.slice(0, i + 1).every((p) => !/\d|^BLDG/i.test(p))) : [parts[0]];
  const city = (cityParts.join("-") || parts[1])
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return { raw: city, country: m[1] };
}

type ListItem = { title: string; externalPath: string; locationsText?: string; bulletFields?: string[] };
type Facet = { facetParameter?: string; descriptor?: string; id?: string; values?: Facet[] };
type ListPage = { total: number; jobPostings: ListItem[]; facets?: Facet[] };

function findFacet(facets: Facet[] | undefined, param: string): Facet | undefined {
  for (const f of facets ?? []) {
    if (f.facetParameter === param) return f;
    const nested = findFacet(f.values, param);
    if (nested) return nested;
  }
  return undefined;
}

async function fetchPage(c: Config, offset: number, applied?: Record<string, string[]>): Promise<ListPage> {
  const res = await politeFetch(`${apiBase(c)}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      appliedFacets: { ...(c.hiringCompanyIds?.length ? { hiringCompany: c.hiringCompanyIds } : {}), ...applied },
      limit: PAGE_SIZE,
      offset,
      searchText: c.searchText,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`workday ${res.status} for ${c.tenant}/${c.site} jobs (offset ${offset})`);
  return (await res.json()) as ListPage;
}

async function listAll(c: Config): Promise<{ id: string; item: ListItem }[]> {
  let first = await fetchPage(c, 0);
  // A tenant with thousands of postings (e.g. RTX) is scoped server-side: keep only the location facet values that
  // do not match exclude_locations_regex, so paging never touches the excluded postings at all.
  let applied: Record<string, string[]> | undefined;
  const exclude = c.excludeLocations;
  if (exclude) {
    const ids = (findFacet(first.facets, "locations")?.values ?? []).filter((v) => v.id && !exclude.test(v.descriptor ?? "")).map((v) => v.id as string);
    if (ids.length === 0) throw new Error(`workday ${c.tenant}/${c.site}: exclude_locations_regex left no locations`);
    applied = { locations: ids };
    first = await fetchPage(c, 0, applied);
  }
  const pages = Math.max(0, Math.ceil(first.total / PAGE_SIZE) - 1);
  const rest: ListItem[] = [];
  await mapPool(
    Array.from({ length: pages }, (_, i) => (i + 1) * PAGE_SIZE),
    4,
    async (offset) => {
      const page = await fetchPage(c, offset, applied);
      rest.push(...page.jobPostings);
      await sleep(80);
    },
  );

  const seen = new Set<string>();
  const out: { id: string; item: ListItem }[] = [];
  const bulletMatch = c.bulletMatch;
  for (const item of [...first.jobPostings, ...rest]) {
    if (bulletMatch && !item.bulletFields?.some((b) => bulletMatch.test(b))) continue;
    const id = reqId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, item });
  }
  return out;
}

type Detail = { title: string; location: string | null; postedAt: string | null; countryHint: string | null; url: string; text: string | null };

async function fetchDetail(c: Config, externalPath: string): Promise<Detail> {
  const res = await politeFetch(`${apiBase(c)}${externalPath}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`workday ${res.status} for detail ${externalPath}`);
  const j = (await res.json()) as {
    jobPostingInfo?: {
      title?: string;
      location?: string;
      startDate?: string;
      jobDescription?: string;
      externalUrl?: string;
      jobRequisitionLocation?: { country?: { alpha2Code?: string } };
    };
  };
  const info = j.jobPostingInfo ?? {};
  return {
    title: info.title ? decodeEntities(info.title).trim() : "",
    location: info.location ?? null,
    postedAt: info.startDate ? new Date(info.startDate).toISOString() : null,
    countryHint: info.jobRequisitionLocation?.country?.alpha2Code ?? null,
    url: info.externalUrl ?? `${publicBase(c)}${externalPath}`,
    text: info.jobDescription ? htmlToText(decodeEntities(info.jobDescription)) : null,
  };
}

export const workdayDetail: DetailFetcher = async (company, job) => {
  const c = cfg(company);
  const base = publicBase(c);
  if (!job.url.startsWith(base)) return null;
  return (await fetchDetail(c, job.url.slice(base.length))).text;
};

async function fetchWorkday(company: Company, ctx: AdapterContext): Promise<NormalizedJob[]> {
  const c = cfg(company);
  const items = await listAll(c);

  const unknown = items.filter(({ id }) => !ctx.known.has(id));
  const targets = unknown.slice(0, ctx.backfill ? 650 : 30);
  const details = new Map<string, Detail>();
  await mapPool(targets, 4, async ({ id, item }) => {
    try {
      details.set(id, await fetchDetail(c, item.externalPath));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(100);
  });

  return items.map(({ id, item }): NormalizedJob => {
    const d = details.get(id);
    const loc = tidyLocation(d?.location ?? item.locationsText ?? null);
    return {
      external_id: id,
      title: d?.title || ctx.known.get(id) || item.title,
      location_raw: loc.raw,
      remote: /\bremote\b/i.test(loc.raw ?? ""),
      department: null,
      url: d?.url ?? `${publicBase(c)}${item.externalPath}`,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: d?.postedAt ?? null,
      country_hint: d?.countryHint ?? loc.country,
      description: d ? (d.text ?? "") : null,
    };
  });
}

export const workday: Adapter = fetchWorkday;

import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import type { Adapter, AdapterContext, Company, DetailFetcher, NormalizedJob } from "../types.ts";

const PAGE_SIZE = 20; // Workday's CXS API rejects a larger limit (HTTP 400)

type Config = { tenant: string; host: string; site: string; hiringCompanyIds?: string[] };

function cfg(company: { slug: string; source_config: Record<string, unknown> }): Config {
  const { tenant, host, site } = company.source_config;
  if (typeof tenant !== "string" || typeof host !== "string" || typeof site !== "string") {
    throw new Error(`${company.slug}: source_config.tenant/host/site missing`);
  }
  const raw = company.source_config.hiring_company_ids;
  const hiringCompanyIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : undefined;
  return { tenant, host, site, hiringCompanyIds };
}

// The CXS API (what the Workday careers UI itself calls) is the only public way to list postings; no auth required.
const apiBase = (c: Config) => `https://${c.tenant}.${c.host}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.site}`;
const publicBase = (c: Config) => `https://${c.tenant}.${c.host}.myworkdayjobs.com/${c.site}`;

// bulletFields[0] is always the plain requisition id (e.g. "JR12345678"). The trailing segment of externalPath
// usually matches it too, but Workday appends a disambiguator ("-1", "-2", ...) when two postings share a title
// and location, which breaks a path-only extraction — bulletFields doesn't have that problem.
const reqId = (item: { externalPath: string; bulletFields?: string[] }) =>
  (item.bulletFields?.[0] && /^[A-Za-z]{1,4}\d+$/.test(item.bulletFields[0]) ? item.bulletFields[0] : null) ??
  item.externalPath.match(/_([A-Za-z0-9]+)(?:-\d+)?$/)?.[1] ??
  null;

type ListItem = { title: string; externalPath: string; locationsText?: string; bulletFields?: string[] };
type ListPage = { total: number; jobPostings: ListItem[] };

async function fetchPage(c: Config, offset: number): Promise<ListPage> {
  const res = await fetch(`${apiBase(c)}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      appliedFacets: c.hiringCompanyIds?.length ? { hiringCompany: c.hiringCompanyIds } : {},
      limit: PAGE_SIZE,
      offset,
      searchText: "",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`workday ${res.status} for ${c.tenant}/${c.site} jobs (offset ${offset})`);
  return (await res.json()) as ListPage;
}

async function listAll(c: Config): Promise<{ id: string; item: ListItem }[]> {
  const first = await fetchPage(c, 0);
  const pages = Math.max(0, Math.ceil(first.total / PAGE_SIZE) - 1);
  const rest: ListItem[] = [];
  await mapPool(
    Array.from({ length: pages }, (_, i) => (i + 1) * PAGE_SIZE),
    4,
    async (offset) => {
      const page = await fetchPage(c, offset);
      rest.push(...page.jobPostings);
      await sleep(80);
    },
  );

  const seen = new Set<string>();
  const out: { id: string; item: ListItem }[] = [];
  for (const item of [...first.jobPostings, ...rest]) {
    const id = reqId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, item });
  }
  return out;
}

type Detail = { title: string; location: string | null; postedAt: string | null; countryHint: string | null; url: string; text: string | null };

async function fetchDetail(c: Config, externalPath: string): Promise<Detail> {
  const res = await fetch(`${apiBase(c)}${externalPath}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
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
    return {
      external_id: id,
      title: d?.title || ctx.known.get(id) || item.title,
      location_raw: d?.location ?? item.locationsText ?? null,
      remote: /\bremote\b/i.test(d?.location ?? item.locationsText ?? ""),
      department: null,
      url: d?.url ?? `${publicBase(c)}${item.externalPath}`,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: d?.postedAt ?? null,
      country_hint: d?.countryHint ?? null,
      description: d ? (d.text ?? "") : null,
    };
  });
}

export const workday: Adapter = fetchWorkday;

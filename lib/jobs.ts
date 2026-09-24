import { sql } from "./db.ts";
import { EXPERIENCE_BUCKETS, type ExperienceBucket } from "./experience.ts";
import { timeAgo } from "./format.ts";
import { EU_COUNTRIES, EUROPE_COUNTRIES, type Scope } from "./geo.ts";
import { sortSectors } from "./sectors.ts";

export type Sort = "latest" | "oldest" | "az" | "za";

export const SORTS: { value: Sort; label: string }[] = [
  { value: "latest", label: "LATEST" },
  { value: "oldest", label: "OLDEST" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
];

export function parseSort(value: string | undefined): Sort {
  return SORTS.some((s) => s.value === value) ? (value as Sort) : "latest";
}

// Alphabetical key: skips leading bracketed tags and symbols, so "(Senior) Project Manager" sits with "Project Manager"
const TITLE_KEY = "lower(coalesce(nullif(regexp_replace(j.title, '^([[:space:]]*[([][^])]*[])])*[^[:alnum:]]*', ''), ''), j.title))";

const ORDER: Record<Sort, string> = {
  latest: "j.first_seen_at desc, j.id",
  oldest: "j.first_seen_at asc, j.id",
  az: `${TITLE_KEY} asc, j.id`,
  za: `${TITLE_KEY} desc, j.id`,
};

export type Filters = {
  q: string;
  sector: string | null;
  scope: Scope;
  countries: string[];
  companies: string[];
  experience: ExperienceBucket | null;
  sort: Sort;
  remote: boolean;
  newOnly: boolean;
};

export type JobView = {
  id: string;
  title: string;
  url: string;
  company: string;
  companySlug: string;
  logo: string | null;
  sector: string | null;
  city: string | null;
  cities: string[];
  countries: string[];
  locationRaw: string | null;
  remote: boolean;
  department: string | null;
  salary: string | null;
  experience: { min: number; max: number | null; kind: string } | null;
  firstSeenAt: string;
  ago: string;
};

type Skip = { countries?: boolean; companies?: boolean };

function where(f: Filters, skip: Skip = {}) {
  const params: unknown[] = [];
  const add = (value: unknown) => `$${params.push(value)}`;
  const clauses = ["j.removed_at is null", "c.active"];

  if (f.q) {
    const escaped = f.q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    clauses.push(`j.title ilike ${add(`%${escaped}%`)}`);
  }
  if (f.sector) clauses.push(`c.sector = ${add(f.sector)}`);
  if (f.remote) clauses.push("j.remote");
  if (f.newOnly) clauses.push("j.first_seen_at > now() - interval '24 hours'");
  if (!skip.companies && f.companies.length > 0) clauses.push(`c.slug = any(${add(f.companies)}::text[])`);
  if (f.experience) {
    const { lo, hi } = EXPERIENCE_BUCKETS[f.experience];
    clauses.push(`j.experience_min is not null and j.experience_min <= ${add(hi)} and coalesce(j.experience_max, 99) >= ${add(lo)}`);
  }

  if (!skip.countries && f.countries.length > 0) {
    clauses.push(`j.location_countries && ${add(f.countries)}::text[]`);
  } else if (f.scope === "eu") {
    clauses.push(`j.location_countries && ${add([...EU_COUNTRIES])}::text[]`);
  } else if (f.scope === "europe") {
    clauses.push(`j.location_countries && ${add([...EUROPE_COUNTRIES])}::text[]`);
  }
  return { sql: clauses.join(" and "), params };
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min === null && max === null) return null;
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const symbol = ({ EUR: "€", USD: "$", GBP: "£" } as Record<string, string>)[currency ?? ""] ?? (currency ? `${currency} ` : "");
  return min !== null && max !== null && min !== max ? `${symbol}${k(min)}–${k(max)}` : `${symbol}${k((min ?? max) as number)}`;
}

type Row = Record<string, unknown>;

export async function listJobs(f: Filters, limit: number): Promise<{ jobs: JobView[]; total: number }> {
  const now = Date.now();
  const w = where(f);
  const [rows, totals] = await Promise.all([
    sql().query(
      `select j.id, j.title, j.url, c.name as company, c.slug as company_slug, c.logo_url, c.sector, j.location_city, j.location_cities, j.location_countries,
              j.location_raw, j.remote, j.department, j.salary_min, j.salary_max, j.salary_currency,
              j.experience_min, j.experience_max, j.experience_kind,
              j.first_seen_at
       from jobs j join companies c on c.id = j.company_id
       where ${w.sql}
       order by ${ORDER[f.sort]}
       limit ${limit}`,
      w.params,
    ),
    sql().query(`select count(*)::int as n from jobs j join companies c on c.id = j.company_id where ${w.sql}`, w.params),
  ]);

  const jobs = (rows as Row[]).map((r): JobView => ({
    id: String(r.id),
    title: String(r.title),
    url: String(r.url),
    company: String(r.company),
    companySlug: String(r.company_slug),
    logo: (r.logo_url as string | null) ?? null,
    sector: (r.sector as string | null) ?? null,
    city: (r.location_city as string | null) ?? null,
    cities: (r.location_cities as string[] | null) ?? [],
    countries: (r.location_countries as string[] | null) ?? [],
    locationRaw: (r.location_raw as string | null) ?? null,
    remote: Boolean(r.remote),
    department: (r.department as string | null) ?? null,
    salary: formatSalary(r.salary_min as number | null, r.salary_max as number | null, r.salary_currency as string | null),
    experience:
      r.experience_min === null
        ? null
        : { min: r.experience_min as number, max: (r.experience_max as number | null) ?? null, kind: String(r.experience_kind) },
    firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    ago: timeAgo(new Date(r.first_seen_at as string).toISOString(), now),
  }));
  return { jobs, total: (totals as Row[])[0].n as number };
}

async function facet(f: Filters, skip: Skip, select: string, from: string, group: string): Promise<Row[]> {
  const w = where(f, skip);
  return (await sql().query(`select ${select} from ${from} where ${w.sql} group by ${group}`, w.params)) as Row[];
}

const JOINED = "jobs j join companies c on c.id = j.company_id";

// Counts per country under every filter except the country selection (drives the map)
export async function countryFacets(f: Filters): Promise<Record<string, number>> {
  const rows = await facet(f, { countries: true }, "cc as country, count(*)::int as n", `${JOINED}, unnest(j.location_countries) as cc`, "cc");
  return Object.fromEntries(rows.map((r) => [String(r.country), r.n as number]));
}

// Counts per country worldwide under the remaining filters (drives the advanced country list)
export async function allCountryFacets(f: Filters): Promise<Record<string, number>> {
  return countryFacets({ ...f, scope: "all" });
}

export type CompanyFacet = { slug: string; name: string; n: number };

export async function companyFacets(f: Filters): Promise<CompanyFacet[]> {
  const rows = await facet(f, { companies: true }, "c.slug, c.name, count(*)::int as n", JOINED, "c.slug, c.name");
  return rows.map((r) => ({ slug: String(r.slug), name: String(r.name), n: r.n as number })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

export async function sectors(): Promise<string[]> {
  const rows = await sql().query("select distinct sector from companies where active and sector is not null order by 1");
  return sortSectors((rows as Row[]).map((r) => String(r.sector)));
}

export async function headline() {
  const rows = (await sql().query(
    `select (select count(*)::int from jobs j join companies c on c.id = j.company_id where j.removed_at is null and c.active) as roles,
            (select count(*)::int from companies where active) as companies,
            (select max(finished_at) from scrape_runs where status = 'success') as last_scrape`,
  )) as Row[];
  const r = rows[0];
  return {
    roles: r.roles as number,
    companies: r.companies as number,
    updated: r.last_scrape ? timeAgo(new Date(r.last_scrape as string).toISOString(), Date.now()) : null,
  };
}

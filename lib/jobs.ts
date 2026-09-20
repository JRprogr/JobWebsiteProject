import { sql } from "./db.ts";
import { timeAgo } from "./format.ts";
import { EU_COUNTRIES, EUROPE_COUNTRIES, type Scope } from "./geo.ts";

export type Filters = {
  q: string;
  sector: string | null;
  scope: Scope;
  countries: string[];
  remote: boolean;
  newOnly: boolean;
};

export type JobView = {
  id: string;
  title: string;
  url: string;
  company: string;
  companySlug: string;
  sector: string | null;
  city: string | null;
  countries: string[];
  locationRaw: string | null;
  remote: boolean;
  department: string | null;
  salary: string | null;
  postedAt: string;
  firstSeenAt: string;
  ago: string;
};

function where(f: Filters, opts: { skipCountries?: boolean } = {}) {
  const params: unknown[] = [];
  const add = (value: unknown) => `$${params.push(value)}`;
  const clauses = ["j.removed_at is null", "c.active"];

  if (f.q) {
    const escaped = f.q.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const p = add(`%${escaped}%`);
    clauses.push(`(j.title ilike ${p} or c.name ilike ${p} or j.location_raw ilike ${p} or j.department ilike ${p})`);
  }
  if (f.sector) clauses.push(`c.sector = ${add(f.sector)}`);
  if (f.remote) clauses.push("j.remote");
  if (f.newOnly) clauses.push("j.first_seen_at > now() - interval '24 hours'");

  if (!opts.skipCountries && f.countries.length > 0) {
    clauses.push(`j.location_countries && ${add(f.countries)}::text[]`);
  } else if (f.countries.length === 0 || opts.skipCountries) {
    if (f.scope === "eu") clauses.push(`j.location_countries && ${add([...EU_COUNTRIES])}::text[]`);
    else if (f.scope === "europe") clauses.push(`j.location_countries && ${add([...EUROPE_COUNTRIES])}::text[]`);
    else if (f.scope === "outside") {
      clauses.push(`cardinality(j.location_countries) > 0 and not (j.location_countries && ${add([...EUROPE_COUNTRIES])}::text[])`);
    }
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
      `select j.id, j.title, j.url, c.name as company, c.slug as company_slug, c.sector, j.location_city, j.location_countries,
              j.location_raw, j.remote, j.department, j.salary_min, j.salary_max, j.salary_currency,
              coalesce(j.posted_at, j.first_seen_at) as posted_at, j.first_seen_at
       from jobs j join companies c on c.id = j.company_id
       where ${w.sql}
       order by coalesce(j.posted_at, j.first_seen_at) desc, j.id
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
    sector: (r.sector as string | null) ?? null,
    city: (r.location_city as string | null) ?? null,
    countries: (r.location_countries as string[] | null) ?? [],
    locationRaw: (r.location_raw as string | null) ?? null,
    remote: Boolean(r.remote),
    department: (r.department as string | null) ?? null,
    salary: formatSalary(r.salary_min as number | null, r.salary_max as number | null, r.salary_currency as string | null),
    postedAt: new Date(r.posted_at as string).toISOString(),
    firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    ago: timeAgo(new Date(r.posted_at as string).toISOString(), now),
  }));
  return { jobs, total: (totals as Row[])[0].n as number };
}

export async function countryFacets(f: Filters): Promise<Record<string, number>> {
  const w = where({ ...f, countries: [] }, { skipCountries: true });
  const rows = await sql().query(
    `select cc as country, count(*)::int as n
     from jobs j join companies c on c.id = j.company_id, unnest(j.location_countries) as cc
     where ${w.sql} group by cc`,
    w.params,
  );
  return Object.fromEntries((rows as Row[]).map((r) => [String(r.country), r.n as number]));
}

export async function allCountryFacets(f: Filters): Promise<Record<string, number>> {
  const w = where({ ...f, countries: [], scope: "all" });
  const rows = await sql().query(
    `select cc as country, count(*)::int as n
     from jobs j join companies c on c.id = j.company_id, unnest(j.location_countries) as cc
     where ${w.sql} group by cc`,
    w.params,
  );
  return Object.fromEntries((rows as Row[]).map((r) => [String(r.country), r.n as number]));
}

export async function sectors(): Promise<string[]> {
  const rows = await sql().query("select distinct sector from companies where active and sector is not null order by 1");
  return (rows as Row[]).map((r) => String(r.sector));
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

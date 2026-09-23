import { sql } from "./db.ts";
import { EXPERIENCE_BUCKETS } from "./experience.ts";
import { timeAgo } from "./format.ts";
import { EU_COUNTRIES, EUROPE_COUNTRIES } from "./geo.ts";
import { sectorLabel } from "./sectors.ts";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export const RANGES = [7, 30] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | undefined): Range {
  return value === "30" ? 30 : 7;
}

// A company's first successful scrape loads its whole backlog; only jobs first seen after it count as "added"
const BASELINE = "(select company_id, min(finished_at) as at from scrape_runs where status = 'success' group by company_id)";
const ADDED = "j.first_seen_at > b.at";

export type Overview = { open: number; europe: number; eu: number; companies: number; added: number; removed: number; lastScrape: string | null };

export type CompanyStat = { slug: string; name: string; sector: string | null; open: number; europe: number; added: number; removed: number };

export type DayPoint = { day: string; open: number; eu: number; added: number; removed: number };

export type Bar = { key: string; label: string; n: number };

export type Stats = {
  overview: Overview;
  companies: CompanyStat[];
  timeline: DayPoint[];
  countries: Bar[];
  experience: Bar[];
  sectors: Bar[];
};

export async function loadStats(range: Range): Promise<Stats> {
  const db = sql();
  const europe = [...EUROPE_COUNTRIES];
  const eu = [...EU_COUNTRIES];

  const [ov, perCompany, timeline, countries, experience, sectors] = await Promise.all([
    db.query(
      `select
         count(*) filter (where j.removed_at is null)::int as open,
         count(*) filter (where j.removed_at is null and j.location_countries && $1::text[])::int as europe,
         count(*) filter (where j.removed_at is null and j.location_countries && $2::text[])::int as eu,
         count(*) filter (where ${ADDED} and j.first_seen_at > now() - make_interval(days => $3))::int as added,
         count(*) filter (where j.removed_at > now() - make_interval(days => $3))::int as removed,
         (select count(*)::int from companies where active) as companies,
         (select max(finished_at) from scrape_runs where status = 'success') as last_scrape
       from jobs j join companies c on c.id = j.company_id and c.active
       left join ${BASELINE} b on b.company_id = j.company_id`,
      [europe, eu, range],
    ),
    db.query(
      `select c.slug, c.name, c.sector,
         count(j.id) filter (where j.removed_at is null)::int as open,
         count(j.id) filter (where j.removed_at is null and j.location_countries && $1::text[])::int as europe,
         count(j.id) filter (where ${ADDED} and j.first_seen_at > now() - make_interval(days => $2))::int as added,
         count(j.id) filter (where j.removed_at > now() - make_interval(days => $2))::int as removed
       from companies c left join jobs j on j.company_id = c.id
       left join ${BASELINE} b on b.company_id = c.id
       where c.active group by c.slug, c.name, c.sector`,
      [europe, range],
    ),
    db.query(
      `with span as (
         select greatest((min(first_seen_at))::date, current_date - 29) as from_day from jobs
       ), days as (
         select d::date as day from span, generate_series(span.from_day, current_date, interval '1 day') d
       )
       select to_char(days.day, 'YYYY-MM-DD') as day,
         count(*) filter (where j.first_seen_at < days.day + 1 and (j.removed_at is null or j.removed_at >= days.day + 1))::int as open,
         count(*) filter (where j.first_seen_at < days.day + 1 and (j.removed_at is null or j.removed_at >= days.day + 1)
                            and j.location_countries && $1::text[])::int as eu,
         count(*) filter (where ${ADDED} and j.first_seen_at::date = days.day)::int as added,
         count(*) filter (where j.removed_at::date = days.day)::int as removed
       from days cross join jobs j left join ${BASELINE} b on b.company_id = j.company_id
       group by days.day order by days.day`,
      [eu],
    ),
    db.query(
      `select cc as key, count(*)::int as n from jobs j join companies c on c.id = j.company_id and c.active, unnest(j.location_countries) cc
       where j.removed_at is null group by cc order by n desc limit 10`,
    ),
    db.query(
      `select case when j.experience_min is null then 'unknown'
                   when j.experience_min <= ${EXPERIENCE_BUCKETS.entry.hi} then 'entry'
                   when j.experience_min <= ${EXPERIENCE_BUCKETS.mid.hi} then 'mid' else 'senior' end as key,
              count(*)::int as n
       from jobs j join companies c on c.id = j.company_id and c.active where j.removed_at is null group by 1`,
    ),
    db.query(
      `select coalesce(c.sector, 'other') as key, count(*)::int as n from jobs j join companies c on c.id = j.company_id and c.active
       where j.removed_at is null group by 1 order by n desc`,
    ),
  ]);

  const o = (ov as Row[])[0];
  const expLabel: Record<string, string> = {
    entry: EXPERIENCE_BUCKETS.entry.label,
    mid: EXPERIENCE_BUCKETS.mid.label,
    senior: EXPERIENCE_BUCKETS.senior.label,
    unknown: "NOT STATED",
  };
  const expOrder = ["entry", "mid", "senior", "unknown"];

  return {
    overview: {
      open: num(o.open),
      europe: num(o.europe),
      eu: num(o.eu),
      companies: num(o.companies),
      added: num(o.added),
      removed: num(o.removed),
      lastScrape: o.last_scrape ? new Date(o.last_scrape as string).toISOString() : null,
    },
    companies: (perCompany as Row[])
      .map((r) => ({ slug: String(r.slug), name: String(r.name), sector: (r.sector as string | null) ?? null, open: num(r.open), europe: num(r.europe), added: num(r.added), removed: num(r.removed) }))
      .sort((a, b) => b.open - a.open),
    timeline: (timeline as Row[]).map((r) => ({ day: String(r.day), open: num(r.open), eu: num(r.eu), added: num(r.added), removed: num(r.removed) })),
    countries: (countries as Row[]).map((r) => ({ key: String(r.key), label: String(r.key), n: num(r.n) })),
    experience: expOrder.map((k) => ({ key: k, label: expLabel[k], n: num((experience as Row[]).find((r) => r.key === k)?.n) })),
    sectors: (sectors as Row[]).map((r) => ({ key: String(r.key), label: sectorLabel(String(r.key)), n: num(r.n) })),
  };
}

export type Register = {
  slug: string;
  name: string;
  sector: string | null;
  hq: string | null;
  careersUrl: string | null;
  source: string;
  open: number;
  europe: number;
  eu: number;
  checked: string | null;
};

export async function loadRegister(): Promise<Register[]> {
  const rows = (await sql().query(
    `select c.slug, c.name, c.sector, c.hq_country, c.careers_url, c.source_type,
       count(j.id) filter (where j.removed_at is null)::int as open,
       count(j.id) filter (where j.removed_at is null and j.location_countries && $1::text[])::int as europe,
       count(j.id) filter (where j.removed_at is null and j.location_countries && $2::text[])::int as eu,
       (select max(finished_at) from scrape_runs r where r.company_id = c.id and r.status = 'success') as last_scrape
     from companies c left join jobs j on j.company_id = c.id
     where c.active group by c.id order by open desc, c.name`,
    [[...EUROPE_COUNTRIES], [...EU_COUNTRIES]],
  )) as Row[];
  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    sector: (r.sector as string | null) ?? null,
    hq: (r.hq_country as string | null) ?? null,
    careersUrl: (r.careers_url as string | null) ?? null,
    source: String(r.source_type),
    open: num(r.open),
    europe: num(r.europe),
    eu: num(r.eu),
    checked: r.last_scrape ? timeAgo(new Date(r.last_scrape as string).toISOString(), Date.now()) : null,
  }));
}

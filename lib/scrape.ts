import { adapterFor } from "./adapters/index.ts";
import { sql } from "./db.ts";
import { extractExperience, type Experience } from "./experience.ts";
import { parseLocation } from "./location.ts";
import type { Company, NormalizedJob } from "./types.ts";

export type ScrapeResult = {
  slug: string;
  status: "success" | "failed";
  found: number;
  added: number;
  removed: number;
  detailed: number;
  error?: string;
};

const UPSERT = `
with input as (
  select * from unnest(
    $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::boolean[], $9::text[], $10::text[],
    $11::int[], $12::int[], $13::text[], $14::text[], $17::int[], $18::int[], $19::text[], $20::boolean[]
  ) as t(external_id, title, location_raw, location_country, location_countries, location_city, remote, department, url,
         salary_min, salary_max, salary_currency, posted_at, experience_min, experience_max, experience_kind, checked)
)
insert into jobs (company_id, external_id, title, location_raw, location_country, location_countries, location_city, remote,
                  department, url, salary_min, salary_max, salary_currency, posted_at, source_type, last_seen_at,
                  experience_min, experience_max, experience_kind, details_checked_at)
select $1::uuid, external_id, title, location_raw, location_country, coalesce(string_to_array(nullif(location_countries, ''), ','), '{}'::text[]),
       location_city, remote, department, url, salary_min, salary_max, salary_currency, posted_at::timestamptz, $15, $16::timestamptz,
       experience_min, experience_max, experience_kind, case when checked then $16::timestamptz end
from input
on conflict (company_id, external_id) do update set
  title = excluded.title,
  location_raw = excluded.location_raw,
  location_country = excluded.location_country,
  location_countries = excluded.location_countries,
  location_city = excluded.location_city,
  remote = excluded.remote,
  department = excluded.department,
  url = excluded.url,
  salary_min = excluded.salary_min,
  salary_max = excluded.salary_max,
  salary_currency = excluded.salary_currency,
  posted_at = coalesce(excluded.posted_at, jobs.posted_at),
  source_type = excluded.source_type,
  last_seen_at = excluded.last_seen_at,
  removed_at = null,
  experience_min = case when excluded.experience_kind is not null then excluded.experience_min else jobs.experience_min end,
  experience_max = case when excluded.experience_kind is not null then excluded.experience_max else jobs.experience_max end,
  experience_kind = coalesce(excluded.experience_kind, jobs.experience_kind),
  details_checked_at = coalesce(excluded.details_checked_at, jobs.details_checked_at)
returning (xmax = 0) as inserted
`;

function dedupe(jobs: NormalizedJob[]): NormalizedJob[] {
  return [...new Map(jobs.map((j) => [j.external_id, j])).values()];
}

export async function scrapeCompany(company: Company, opts: { backfill?: boolean } = {}): Promise<ScrapeResult> {
  const db = sql();
  const startedAt = new Date().toISOString();
  const [{ id: runId }] = await db.query(
    "insert into scrape_runs (company_id, started_at) values ($1, $2) returning id",
    [company.id, startedAt],
  );

  try {
    const knownRows = await db.query(
      "select external_id, title from jobs where company_id = $1 and details_checked_at is not null",
      [company.id],
    );
    const known = new Map<string, string>(knownRows.map((r) => [String(r.external_id), String(r.title)]));

    const jobs = dedupe(await adapterFor(company)(company, { known, backfill: opts.backfill ?? false }));
    const defaultCountry =
      typeof company.source_config.default_country === "string" ? company.source_config.default_country : null;
    const loc = jobs.map((j) => parseLocation(j.location_raw, j.country_hint, defaultCountry));

    // Only jobs with fresh text (or brand-new ones, from the title alone) get an experience value; known jobs keep theirs.
    const exp: (Experience | null)[] = jobs.map((j) => {
      if (j.description !== null && j.description !== undefined) return extractExperience(j.description, j.title);
      return known.has(j.external_id) ? null : extractExperience(null, j.title);
    });
    const checked = jobs.map((j) => j.description !== null && j.description !== undefined);

    const [{ n: activeBefore }] = await db.query(
      "select count(*)::int as n from jobs where company_id = $1 and removed_at is null",
      [company.id],
    );
    if (jobs.length === 0 && activeBefore > 0) {
      throw new Error(`source returned 0 jobs but ${activeBefore} are active; refusing to mark them removed`);
    }

    const [upserted, removedRows] = await db.transaction([
      db.query(UPSERT, [
        company.id,
        jobs.map((j) => j.external_id),
        jobs.map((j) => j.title),
        jobs.map((j) => j.location_raw),
        loc.map((l) => l.country),
        loc.map((l) => l.countries.join(",")),
        loc.map((l) => l.city),
        jobs.map((j, i) => j.remote || loc[i].remote),
        jobs.map((j) => j.department),
        jobs.map((j) => j.url),
        jobs.map((j) => j.salary_min),
        jobs.map((j) => j.salary_max),
        jobs.map((j) => j.salary_currency),
        jobs.map((j) => j.posted_at),
        company.source_type,
        startedAt,
        exp.map((e) => e?.min ?? null),
        exp.map((e) => e?.max ?? null),
        exp.map((e) => e?.kind ?? null),
        checked,
      ]),
      db.query(
        "update jobs set removed_at = $2::timestamptz where company_id = $1 and removed_at is null and last_seen_at < $2::timestamptz returning id",
        [company.id, startedAt],
      ),
      db.query("update jobs set posted_at = first_seen_at where company_id = $1 and posted_at is null", [company.id]),
    ]);

    const added = upserted.filter((r) => r.inserted === true).length;
    const removed = removedRows.length;
    await db.query(
      "update scrape_runs set finished_at = now(), status = 'success', jobs_found = $2, jobs_added = $3, jobs_removed = $4 where id = $1",
      [runId, jobs.length, added, removed],
    );
    return { slug: company.slug, status: "success", found: jobs.length, added, removed, detailed: checked.filter(Boolean).length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.query("update scrape_runs set finished_at = now(), status = 'failed', error = $2 where id = $1", [runId, error]);
    return { slug: company.slug, status: "failed", found: 0, added: 0, removed: 0, detailed: 0, error };
  }
}

export async function loadCompanies(slugs: string[]): Promise<Company[]> {
  const rows = slugs.length
    ? await sql().query("select * from companies where slug = any($1::text[])", [slugs])
    : await sql().query("select * from companies where active order by name");
  return rows as Company[];
}

const CONCURRENCY = 4;

export type DueOptions = { budgetMs: number; minAgeMs: number };

export async function scrapeDue({ budgetMs, minAgeMs }: DueOptions) {
  const deadline = Date.now() + budgetMs;
  const due = (await sql().query(
    `select c.* from companies c
     where c.active
       and coalesce((select max(r.started_at) from scrape_runs r where r.company_id = c.id), 'epoch') < now() - make_interval(secs => $1)
     order by coalesce((select max(r.started_at) from scrape_runs r where r.company_id = c.id), 'epoch'), c.name`,
    [minAgeMs / 1000],
  )) as Company[];

  const results: ScrapeResult[] = [];
  const queue = [...due];
  const worker = async () => {
    for (let company = queue.shift(); company && Date.now() < deadline; company = queue.shift()) {
      results.push(await scrapeCompany(company));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { due: due.length, ran: results.length, deferred: due.length - results.length, results };
}

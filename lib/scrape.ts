import { adapterFor } from "./adapters/index.ts";
import { retryDb, sql } from "./db.ts";
import { extractExperience, type Experience } from "./experience.ts";
import { parseLocation } from "./location.ts";
import { fillTexts, storesText } from "./texts.ts";
import { MAX_DETAIL_CHARS } from "./text.ts";
import type { Company, NormalizedJob } from "./types.ts";

// "partial" = the source answered but so much of the board vanished that the removals were held back (see the guard below)
export type ScrapeResult = {
  slug: string;
  status: "success" | "partial" | "failed";
  found: number;
  added: number;
  removed: number;
  detailed: number;
  texts: number; // listing texts stored in this run (from the scrape itself and from the top-up)
  seconds: number;
  error?: string;
};

// Result guard: a run that would remove more than 30% of a company's active jobs (or all of them) is probably a broken or
// blocked source, not a hiring stop. The jobs it did see are still upserted, but nothing is marked removed until the next
// run reports (nearly) the same reduced count, which is what a real drop looks like.
const GUARD_MIN_ACTIVE = 10;
const GUARD_MAX_DROP = 0.3;

const UPSERT = `
with input as (
  select * from unnest(
    $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::boolean[], $9::text[], $10::text[],
    $11::int[], $12::int[], $13::text[], $14::text[], $17::int[], $18::int[], $19::text[], $20::boolean[], $21::text[]
  ) as t(external_id, title, location_raw, location_country, location_countries, location_city, remote, department, url,
         salary_min, salary_max, salary_currency, posted_at, experience_min, experience_max, experience_kind, checked, location_cities)
)
insert into jobs (company_id, external_id, title, location_raw, location_country, location_countries, location_city, remote,
                  department, url, salary_min, salary_max, salary_currency, posted_at, source_type, last_seen_at,
                  experience_min, experience_max, experience_kind, details_checked_at, location_cities)
select $1::uuid, external_id, title, location_raw, location_country, coalesce(string_to_array(nullif(location_countries, ''), ','), '{}'::text[]),
       location_city, remote, department, url, salary_min, salary_max, salary_currency, posted_at::timestamptz, $15, $16::timestamptz,
       experience_min, experience_max, experience_kind, case when checked then $16::timestamptz end,
       coalesce(string_to_array(nullif(location_cities, ''), ','), '{}'::text[])
from input
on conflict (company_id, external_id) do update set
  title = excluded.title,
  location_raw = coalesce(excluded.location_raw, jobs.location_raw),
  -- A source whose country/city only comes from a per-job detail fetch (e.g. Workday) reports none of that for a
  -- job it didn't re-fetch this run; keep the last resolved value instead of blanking it out.
  location_country = coalesce(excluded.location_country, jobs.location_country),
  location_countries = case when excluded.location_countries = '{}' then jobs.location_countries else excluded.location_countries end,
  location_city = coalesce(excluded.location_city, jobs.location_city),
  location_cities = case when excluded.location_cities = '{}' then jobs.location_cities else excluded.location_cities end,
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

// Listing text the adapter downloaded anyway. An empty body only marks "processed, the source has no text" and never
// overwrites text that is already stored.
const STORE_TEXT = `
insert into job_details (job_id, body)
select j.id, t.body
from unnest($2::text[], $3::text[]) as t(external_id, body)
join jobs j on j.company_id = $1::uuid and j.external_id = t.external_id
on conflict (job_id) do update set body = excluded.body, fetched_at = now() where excluded.body <> ''
`;

// Jobs still without stored text after a scrape get some from the source's detail fetcher, this many per run and company
const TOP_UP = 20;

function dedupe(jobs: NormalizedJob[]): NormalizedJob[] {
  return [...new Map(jobs.map((j) => [j.external_id, j])).values()];
}

// Never throws: missing texts must not turn a good scrape into a failed one
async function topUp(company: Company, fill: number | undefined): Promise<number> {
  try {
    return await fillTexts(company, fill ?? TOP_UP);
  } catch {
    return 0;
  }
}

// A drop is confirmed when the runs just before this one were all held back by the guard and saw about as many jobs as this
// one does. Nothing at all is far more often a blocked source than a company that closed every role, so an empty result
// only counts as confirmed once the empty streak is a day old; any other drop needs just the one earlier run.
const EMPTY_CONFIRM_MS = 24 * 60 * 60 * 1000;

async function dropConfirmed(companyId: string, runId: string, found: number): Promise<boolean> {
  const runs = await retryDb(() =>
    sql().query(
      "select status, jobs_found, started_at from scrape_runs where company_id = $1 and id <> $2 and finished_at is not null order by started_at desc limit 60",
      [companyId, runId],
    ),
  );
  const similar = (n: number) => Math.abs(n - found) <= Math.max(2, Math.round(found * 0.05));
  let oldest: string | null = null;
  for (const r of runs) {
    if (r.status !== "partial" || !similar(Number(r.jobs_found))) break;
    oldest = String(r.started_at);
  }
  if (oldest === null) return false;
  return found > 0 || Date.now() - new Date(oldest).getTime() >= EMPTY_CONFIRM_MS;
}

// `force` skips the guard, for a deliberate change such as a rewritten adapter that legitimately finds far fewer jobs;
// `fill` is how many missing listing texts to fetch afterwards (default TOP_UP)
export async function scrapeCompany(company: Company, opts: { backfill?: boolean; force?: boolean; fill?: number } = {}): Promise<ScrapeResult> {
  const db = sql();
  const q = (text: string, params: unknown[] = []) => retryDb(() => db.query(text, params));
  const t0 = Date.now();
  const startedAt = new Date(t0).toISOString();
  let runId: string | null = null;

  // Never throws: whatever goes wrong (source, database) ends up as a "failed" result, so one company cannot take a whole run down
  try {
    const [run] = await q("insert into scrape_runs (company_id, started_at) values ($1, $2) returning id", [company.id, startedAt]);
    runId = String(run.id);

    const knownRows = await q(
      "select external_id, title from jobs where company_id = $1 and details_checked_at is not null",
      [company.id],
    );
    const known = new Map<string, string>(knownRows.map((r) => [String(r.external_id), String(r.title)]));

    // source_config.place_aliases renames places a source uses for a district ({"Kista": "Stockholm"}), so listings show the city
    const aliases = Object.entries((company.source_config.place_aliases ?? {}) as Record<string, string>);
    const rename = (raw: string | null) => (raw ? aliases.reduce((s, [from, to]) => s.split(from).join(to), raw) : raw);
    const jobs = dedupe(await adapterFor(company)(company, { known, backfill: opts.backfill ?? false })).map((j) => ({ ...j, location_raw: rename(j.location_raw) }));
    const defaultCountry =
      typeof company.source_config.default_country === "string" ? company.source_config.default_country : null;
    // A known job whose page was not read again this run comes without a place; the source's default country must not overwrite what
    // its first read resolved (Esyen's Madrid job would turn Italian), so it reports no location and the upsert keeps the stored one.
    const loc = jobs.map((j) =>
      known.has(j.external_id) && !j.location_raw ? parseLocation(null) : parseLocation(j.location_raw, j.country_hint, defaultCountry),
    );

    // Only jobs with fresh text (or brand-new ones, from the title alone) get an experience value; known jobs keep theirs.
    const exp: (Experience | null)[] = jobs.map((j) => {
      if (j.description !== null && j.description !== undefined) return extractExperience(j.description, j.title);
      return known.has(j.external_id) ? null : extractExperience(null, j.title);
    });
    const checked = jobs.map((j) => j.description !== null && j.description !== undefined);

    const active = await q("select external_id from jobs where company_id = $1 and removed_at is null", [company.id]);
    const seen = new Set(jobs.map((j) => j.external_id));
    const missing = active.filter((r) => !seen.has(String(r.external_id))).length;
    const suspicious = missing > 0 && (jobs.length === 0 || (active.length >= GUARD_MIN_ACTIVE && missing > active.length * GUARD_MAX_DROP));
    const hold = suspicious && !opts.force && !(await dropConfirmed(company.id, runId, jobs.length));

    const queries = [
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
        loc.map((l) => l.cities.join(",")),
      ]),
    ];
    if (!hold) {
      queries.push(
        db.query(
          "update jobs set removed_at = $2::timestamptz where company_id = $1 and removed_at is null and last_seen_at < $2::timestamptz returning id",
          [company.id, startedAt],
        ),
      );
    }
    queries.push(db.query("update jobs set posted_at = first_seen_at where company_id = $1 and posted_at is null", [company.id]));
    const withText = jobs.filter((j) => typeof j.description === "string");
    if (storesText(company) && withText.length > 0) {
      queries.push(db.query(STORE_TEXT, [company.id, withText.map((j) => j.external_id), withText.map((j) => (j.description as string).slice(0, MAX_DETAIL_CHARS))]));
    }
    const stored = storesText(company) ? withText.filter((j) => j.description).length : 0;
    const [upserted, removedRows] = await retryDb(() => db.transaction(queries));

    const added = upserted.filter((r) => r.inserted === true).length;
    const removed = hold ? 0 : removedRows.length;
    const detailed = checked.filter(Boolean).length;
    if (hold) {
      const error = `held back: ${missing} of ${active.length} active jobs are missing from this result, removals apply once the next run confirms it`;
      await q(
        "update scrape_runs set finished_at = now(), status = 'partial', jobs_found = $2, jobs_added = $3, jobs_removed = 0, error = $4 where id = $1",
        [runId, jobs.length, added, error],
      );
      return { slug: company.slug, status: "partial", found: jobs.length, added, removed: 0, detailed, texts: stored + (await topUp(company, opts.fill)), seconds: (Date.now() - t0) / 1000, error };
    }
    await q(
      "update scrape_runs set finished_at = now(), status = 'success', jobs_found = $2, jobs_added = $3, jobs_removed = $4 where id = $1",
      [runId, jobs.length, added, removed],
    );
    return { slug: company.slug, status: "success", found: jobs.length, added, removed, detailed, texts: stored + (await topUp(company, opts.fill)), seconds: (Date.now() - t0) / 1000 };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // best effort: if the database itself is the problem the run stays unfinished and is retried after RETRY_MIN
    if (runId) await q("update scrape_runs set finished_at = now(), status = 'failed', error = $2 where id = $1", [runId, error]).catch(() => undefined);
    return { slug: company.slug, status: "failed", found: 0, added: 0, removed: 0, detailed: 0, texts: 0, seconds: (Date.now() - t0) / 1000, error };
  }
}

export async function loadCompanies(slugs: string[]): Promise<Company[]> {
  const rows = slugs.length
    ? await retryDb(() => sql().query("select * from companies where slug = any($1::text[])", [slugs]))
    : await retryDb(() => sql().query("select * from companies where active order by name"));
  return rows as Company[];
}

const CONCURRENCY = 4;

// Companies are scraped hourly unless source_config.every_hours says otherwise (big boards: 6). A run counts as on time
// with SLACK_MIN to spare, so an hourly cron that drifts by a few minutes never skips a whole cycle. After a failed,
// held-back or interrupted run the company is tried again after RETRY_MIN, whatever its own interval.
const SLACK_MIN = 10;
const RETRY_MIN = 50;

type RunOptions = { backfill?: boolean; force?: boolean; fill?: number; budgetMs?: number; onResult?: (result: ScrapeResult) => void };

// Scrapes the companies CONCURRENCY at a time; companies not started before the budget runs out are left for the next run
export async function scrapeMany(companies: Company[], { budgetMs = Infinity, onResult, ...opts }: RunOptions = {}) {
  const deadline = Date.now() + budgetMs;
  const results: ScrapeResult[] = [];
  const queue = [...companies];
  const worker = async () => {
    for (let company = queue.shift(); company && Date.now() < deadline; company = queue.shift()) {
      const result = await scrapeCompany(company, opts);
      results.push(result);
      onResult?.(result);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { total: companies.length, ran: results.length, deferred: companies.length - results.length, results };
}

export async function scrapeDue(opts: RunOptions & { budgetMs: number }) {
  const due = (await retryDb(() => sql().query(
    `select c.* from companies c
     left join lateral (
       select r.started_at, r.status from scrape_runs r where r.company_id = c.id order by r.started_at desc limit 1
     ) last on true
     where c.active
       and (last.started_at is null
            or last.started_at < now() - interval '1 minute' * (
                 case when last.status = 'success'
                      then greatest(coalesce((c.source_config->>'every_hours')::float8, 1) * 60 - $1::float8, $2::float8)
                      else $2::float8 end))
     order by coalesce(last.started_at, 'epoch'::timestamptz), c.name`,
    [SLACK_MIN, RETRY_MIN],
  ))) as Company[];
  return { due: due.length, ...(await scrapeMany(due, opts)) };
}

import { retryDb, sql } from "./db.ts";

// Keeps the database small and tidy. Runs at the end of every scheduled scrape; each step is cheap when there is nothing to do.
//
// - Scrape history older than RUN_DAYS goes, except each company's first successful run: the Statistics page measures
//   everything since that baseline. Added and removed jobs are read from the jobs table, not from these rows.
// - Jobs of a company that was switched off (active = false) are closed, dated to the last time they were seen.
// - Listing text is dropped TEXT_DAYS after its job was closed (a job that comes back gets its text again from the top-up),
//   and always for companies with `store_text: false`.
const RUN_DAYS = 60;
const TEXT_DAYS = 30;

export type Housekeeping = { runs: number; closed: number; texts: number };

const count = async (text: string, params: unknown[] = []) => (await retryDb(() => sql().query(text, params))).length;

export async function housekeeping(): Promise<Housekeeping> {
  const runs = await count(
    `with keep as (select distinct on (company_id) id from scrape_runs where status = 'success' order by company_id, finished_at)
     delete from scrape_runs
     where started_at < now() - make_interval(days => $1) and id not in (select id from keep)
     returning 1`,
    [RUN_DAYS],
  );
  const closed = await count(
    `update jobs j set removed_at = j.last_seen_at
     from companies c where c.id = j.company_id and not c.active and j.removed_at is null
     returning 1`,
  );
  const texts = await count(
    `delete from job_details d using jobs j, companies c
     where j.id = d.job_id and c.id = j.company_id
       and ((j.removed_at is not null and j.removed_at < now() - make_interval(days => $1)) or c.source_config->>'store_text' = 'false')
     returning 1`,
    [TEXT_DAYS],
  );
  return { runs, closed, texts };
}

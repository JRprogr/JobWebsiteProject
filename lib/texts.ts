import { detailFor } from "./adapters/index.ts";
import { retryDb, sql } from "./db.ts";
import { extractExperience } from "./experience.ts";
import { mapPool } from "./pool.ts";
import { MAX_DETAIL_CHARS } from "./text.ts";
import type { Company } from "./types.ts";

// Listing text is stored when a job is scraped (whatever text the adapter downloaded anyway). This tops that up: open jobs of a
// company that still have no stored text get it from the source's own detail fetcher. Used after each scrape with a small
// limit, and for the one-off catch-up (`npm run scrape -- --texts`) with a big one. Only ever runs in the scraper, never in
// the web app, so nothing is fetched from an employer while someone browses the site.
//
// A job whose fetcher answers "no text" gets an empty body as a marker, so it is not asked again every hour; the marker is
// retried after RETRY_EMPTY_DAYS in case the answer was a hiccup. A job whose fetch throws gets nothing and is tried again on
// a later run.
const FILL_CONCURRENCY = 4;
const RETRY_EMPTY_DAYS = 7;

// `store_text: false` in a company's source_config keeps its listing text out of the database entirely
export const storesText = (company: Pick<Company, "source_config">) => company.source_config.store_text !== false;

// After a change to the experience extractor (lib/experience.ts): recompute every open job's experience from the text already
// stored, without asking a single employer. `npm run scrape -- --reextract [slugs]`. A job whose text yields nothing keeps its value.
export async function reextractExperience(slugs: string[] = []): Promise<{ checked: number; changed: number }> {
  let checked = 0;
  let changed = 0;
  let after = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const rows = await retryDb(() =>
      sql().query(
        `select j.id, j.title, j.experience_min, j.experience_max, j.experience_kind, d.body
         from jobs j join companies c on c.id = j.company_id join job_details d on d.job_id = j.id
         where j.removed_at is null and c.active and d.body <> '' and j.id > $1::uuid and (cardinality($2::text[]) = 0 or c.slug = any($2::text[]))
         order by j.id limit 500`,
        [after, slugs],
      ),
    );
    if (rows.length === 0) return { checked, changed };
    const ids: string[] = [];
    const mins: (number | null)[] = [];
    const maxs: (number | null)[] = [];
    const kinds: string[] = [];
    for (const r of rows) {
      after = String(r.id);
      checked++;
      const e = extractExperience(String(r.body), String(r.title));
      if (!e || (e.min === r.experience_min && e.max === r.experience_max && e.kind === r.experience_kind)) continue;
      ids.push(after);
      mins.push(e.min);
      maxs.push(e.max);
      kinds.push(e.kind);
    }
    if (ids.length > 0) {
      await retryDb(() =>
        sql().query(
          `update jobs j set experience_min = t.min, experience_max = t.max, experience_kind = t.kind
           from unnest($1::uuid[], $2::int[], $3::int[], $4::text[]) as t(id, min, max, kind) where j.id = t.id`,
          [ids, mins, maxs, kinds],
        ),
      );
      changed += ids.length;
    }
  }
}

export async function fillTexts(company: Company, limit: number): Promise<number> {
  const fetcher = detailFor(company);
  if (!fetcher || limit <= 0 || !storesText(company)) return 0;

  const jobs = await retryDb(() =>
    sql().query(
      `select j.id, j.external_id, j.url from jobs j
       left join job_details d on d.job_id = j.id
       where j.company_id = $1 and j.removed_at is null
         and (d.job_id is null or (d.body = '' and d.fetched_at < now() - make_interval(days => $3)))
       order by random() limit $2`,
      [company.id, limit, RETRY_EMPTY_DAYS],
    ),
  );

  let stored = 0;
  await mapPool(jobs, FILL_CONCURRENCY, async (job) => {
    let text: string | null;
    try {
      text = await fetcher(company, { external_id: String(job.external_id), url: String(job.url) });
    } catch {
      return;
    }
    const body = (text ?? "").slice(0, MAX_DETAIL_CHARS);
    await retryDb(() =>
      sql().query(
        "insert into job_details (job_id, body) values ($1, $2) on conflict (job_id) do update set body = excluded.body, fetched_at = now() where job_details.body = ''",
        [job.id, body],
      ),
    );
    if (body) stored++;
  });
  return stored;
}

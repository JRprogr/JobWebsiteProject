import { detailFor } from "./adapters/index.ts";
import { retryDb, sql } from "./db.ts";
import { extractExperience } from "./experience.ts";
import { detectLanguage } from "./language.ts";
import { roleType } from "./roles.ts";
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

// After a change to the experience extractor (lib/experience.ts), the language detector (lib/language.ts) or the role types
// (lib/roles.ts): recompute every open job's experience, language and role type from the text already stored, without asking a
// single employer. `npm run scrape -- --reextract [slugs]`. Unlike a normal scrape run (which only ever fills in a value it
// actually found, never blanking one out because this run happened not to re-read the text), this command always has the job's
// complete stored text to work from, so a fresh "nothing here" is trusted and clears a value that an older, now-fixed bug had
// extracted wrongly. A job without stored text keeps its experience and language (they came from the title) and only gets its
// role type, which needs the title alone.
export async function reextractExperience(slugs: string[] = []): Promise<{ checked: number; changed: number }> {
  let checked = 0;
  let changed = 0;
  let after = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const rows = await retryDb(() =>
      sql().query(
        `select j.id, j.title, j.department, j.experience_min, j.experience_max, j.experience_kind, j.language, j.role_type, d.body
         from jobs j join companies c on c.id = j.company_id left join job_details d on d.job_id = j.id
         where j.removed_at is null and c.active and j.id > $1::uuid and (cardinality($2::text[]) = 0 or c.slug = any($2::text[]))
         order by j.id limit 100`,
        [after, slugs],
      ),
    );
    if (rows.length === 0) return { checked, changed };
    const ids: string[] = [];
    const mins: (number | null)[] = [];
    const maxs: (number | null)[] = [];
    const kinds: (string | null)[] = [];
    const langs: (string | null)[] = [];
    const roles: string[] = [];
    for (const r of rows) {
      after = String(r.id);
      checked++;
      const body = r.body ? String(r.body) : "";
      const title = String(r.title);

      let min = r.experience_min as number | null;
      let max = r.experience_max as number | null;
      let kind = r.experience_kind as string | null;
      let language = (r.language as string | null) ?? null;
      if (body !== "") {
        const e = extractExperience(body, title);
        min = e?.min ?? null;
        max = e?.max ?? null;
        kind = e?.kind ?? null;
        language = detectLanguage(body, title);
      } else if (language === null) {
        language = detectLanguage(null, title);
      }
      const role = roleType(title, (r.department as string | null) ?? null);

      const same =
        min === r.experience_min && max === r.experience_max && kind === r.experience_kind && language === (r.language ?? null) && role === r.role_type;
      if (same) continue;
      ids.push(after);
      mins.push(min);
      maxs.push(max);
      kinds.push(kind);
      langs.push(language);
      roles.push(role);
    }
    if (ids.length > 0) {
      await retryDb(() =>
        sql().query(
          `update jobs j set experience_min = t.min, experience_max = t.max, experience_kind = t.kind, language = t.language, role_type = t.role_type
           from unnest($1::uuid[], $2::int[], $3::int[], $4::text[], $5::text[], $6::text[]) as t(id, min, max, kind, language, role_type) where j.id = t.id`,
          [ids, mins, maxs, kinds, langs, roles],
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
      `select j.id, j.external_id, j.url, j.title from jobs j
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
    if (body) {
      stored++;
      // the new text tells more than the title did: language and experience are read from it now
      const title = String(job.title);
      const e = extractExperience(body, title);
      await retryDb(() =>
        sql().query(
          `update jobs set language = coalesce($2, language),
             experience_min = case when $3::int is not null then $3::int else experience_min end,
             experience_max = case when $3::int is not null then $4::int else experience_max end,
             experience_kind = coalesce($5, experience_kind)
           where id = $1`,
          [job.id, detectLanguage(body, title), e?.min ?? null, e?.max ?? null, e?.kind ?? null],
        ),
      );
    }
  });
  return stored;
}

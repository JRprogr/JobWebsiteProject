import { detailFor } from "./adapters/index.ts";
import { sql } from "./db.ts";
import type { Company } from "./types.ts";

export type Details = { text: string; cached: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Full listing text is fetched from the source on first request and cached, so the database only holds text people actually opened.
export async function getJobDetails(jobId: string): Promise<Details | null> {
  if (!UUID_RE.test(jobId)) return null;
  const db = sql();

  const cached = await db.query("select body from job_details where job_id = $1", [jobId]);
  if (cached.length > 0) return { text: String(cached[0].body), cached: true };

  const rows = await db.query(
    `select j.external_id, j.url, c.id, c.name, c.slug, c.logo_url, c.classification, c.source_type, c.source_config, c.active
     from jobs j join companies c on c.id = j.company_id where j.id = $1`,
    [jobId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const company = {
    id: r.id, name: r.name, slug: r.slug, logo_url: r.logo_url, classification: r.classification,
    source_type: r.source_type, source_config: r.source_config, active: r.active,
  } as Company;

  const fetcher = detailFor(company);
  if (!fetcher) return null;
  const text = await fetcher(company, { external_id: String(r.external_id), url: String(r.url) });
  if (!text) return null;

  await db.query("insert into job_details (job_id, body) values ($1, $2) on conflict (job_id) do nothing", [jobId, text]);
  return { text, cached: false };
}

import { sql } from "./db.ts";

export type Details = { text: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The listing text was stored when the job was scraped (lib/scrape.ts, lib/texts.ts). The web app only reads it and never
// contacts an employer: an empty body is the marker for "the source has no text for this job".
export async function getJobDetails(jobId: string): Promise<Details | null> {
  if (!UUID_RE.test(jobId)) return null;
  const rows = await sql().query("select body from job_details where job_id = $1 and body <> ''", [jobId]);
  return rows.length > 0 ? { text: String(rows[0].body) } : null;
}

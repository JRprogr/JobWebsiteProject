import { mapPool, sleep } from "../pool.ts";
import { decodeEntities } from "../text.ts";
import type { AdapterContext, Company, NormalizedJob } from "../types.ts";
import { defaultCountry, isEvergreen } from "./http.ts";

// Shared runner for the small HTML career boards (PeopleForce, HR-ON, Intervieweb, Clarity Loop, link lists): the adapter parses a
// list of rows, this turns them into jobs and fetches each new listing's text (30 per cron run, more with --backfill), like the
// other detail-gated adapters. A row that already carries its text (`text`) needs no fetch.
export type Row = {
  id: string;
  url: string;
  title: string;
  location: string | null;
  department?: string | null;
  remote?: boolean;
  posted?: string | null;
  text?: string | null;
  country?: string | null;
};

export const strip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export async function runBoard(company: Company, ctx: AdapterContext, all: Row[], body: (row: Row) => Promise<string | null>): Promise<NormalizedJob[]> {
  const rows = [...new Map(all.map((r) => [r.id, r])).values()].filter((r) => !isEvergreen(r.title));
  const hint = defaultCountry(company.source_config);

  const targets = rows.filter((r) => r.text === undefined && !ctx.known.has(r.id)).slice(0, ctx.backfill ? 300 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (r) => {
    try {
      texts.set(r.id, await body(r));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return rows.map((r): NormalizedJob => {
    const text = r.text !== undefined ? r.text : texts.has(r.id) ? (texts.get(r.id) ?? "") : null;
    return {
      external_id: r.id,
      title: (ctx.known.get(r.id) ?? r.title).trim(),
      location_raw: r.location,
      remote: r.remote ?? false,
      department: r.department ?? null,
      url: r.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: r.posted ?? null,
      country_hint: r.country ?? hint,
      description: ctx.known.has(r.id) && r.text !== undefined ? null : text,
    };
  });
}

import { sql } from "@/lib/db";

// What the monitors ask: is the database reachable and has a scrape finished recently? It reveals nothing but those two
// facts.
//
// The workflow's cron fires hourly, but GitHub does not promise to run a scheduled workflow on time — for this repo the
// gap between two successful scrapes has ranged from a few minutes up to about 8.5 hours since the schedule went live
// (measured from the Actions run history, 2026-09-30), not just occasionally but on nearly every run. That is GitHub's own
// scheduler being best-effort, not a fault in the workflow or the scraper. The threshold below has margin above the worst
// gap seen so far, so a normal delay does not page anyone; it still catches a schedule that has genuinely stopped (GitHub
// disables a public repo's scheduled workflows after 60 days without a commit) or a source that is failing outright.
const STALE_MINUTES = 720;

export async function GET() {
  try {
    const rows = await sql().query(
      "select extract(epoch from now() - max(finished_at)) / 60 as minutes from scrape_runs where status = 'success'",
    );
    const raw = rows[0]?.minutes;
    const minutes = raw === null || raw === undefined ? null : Math.round(Number(raw));
    const stale = minutes === null || minutes > STALE_MINUTES;
    return Response.json(
      { status: stale ? "stale" : "ok", minutesSinceLastScrape: minutes },
      // a healthy answer may be cached briefly so that a flood of requests does not reach the database; a bad one never
      { status: stale ? 503 : 200, headers: { "cache-control": stale ? "no-store" : "public, s-maxage=30" } },
    );
  } catch {
    return Response.json({ status: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

import { sql } from "@/lib/db";

// What the monitors ask: is the database reachable and has a scrape finished recently? The scrape runs hourly, so three
// hours without a successful one means the schedule has stopped (or every source is failing). It reveals nothing but
// those two facts.
const STALE_MINUTES = 180;

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

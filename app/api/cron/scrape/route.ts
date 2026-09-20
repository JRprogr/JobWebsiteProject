import { timingSafeEqual } from "node:crypto";
import { scrapeDue } from "@/lib/scrape";

export const maxDuration = 60;

const BUDGET_MS = 45_000;
const DEFAULT_MIN_AGE_MINUTES = 30;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const param = new URL(request.url).searchParams.get("minAgeMinutes");
  const minutes = param !== null && Number.isFinite(Number(param)) ? Math.max(0, Number(param)) : DEFAULT_MIN_AGE_MINUTES;

  const summary = await scrapeDue({ budgetMs: BUDGET_MS, minAgeMs: minutes * 60_000 });
  return Response.json(summary);
}

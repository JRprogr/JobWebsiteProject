import { housekeeping } from "../lib/housekeeping.ts";
import { loadCompanies, scrapeDue, scrapeMany, type ScrapeResult } from "../lib/scrape.ts";
import { reextractExperience } from "../lib/texts.ts";

// npm run scrape                     every active company
// npm run scrape -- <slug> [slug…]   just those companies
// npm run scrape -- --due            only companies whose interval has elapsed (what the GitHub workflow runs every hour)
// --texts     also fetch the listing text of every open job that has none stored yet (one-off catch-up, slow; implies --backfill)
// --backfill  read many more listing texts per company in one go (Workday, BambooHR, … only fetch 30 per run otherwise)
// --force     skip the result guard (after a deliberate adapter change)
// Companies run four at a time.
// --reextract recomputes every open job's experience from the stored listing texts (no employer is contacted); use it after a
//             change to lib/experience.ts, optionally for just some slugs
const args = process.argv.slice(2);
if (args.includes("--reextract")) {
  const done = await reextractExperience(args.filter((a) => !a.startsWith("--")));
  console.log(`experience re-read from stored texts: ${done.checked} jobs checked, ${done.changed} changed`);
  process.exit(0);
}
const texts = args.includes("--texts");
const backfill = args.includes("--backfill") || texts;
const force = args.includes("--force");
const due = args.includes("--due");
const slugs = args.filter((a) => !a.startsWith("--"));

const DUE_BUDGET_MS = 25 * 60_000; // the workflow times out at 30 minutes
const ALL_TEXTS = 100_000;

function report(r: ScrapeResult) {
  console.log(
    `${r.slug.padEnd(26)} ${r.status.padEnd(8)} found=${r.found} added=${r.added} removed=${r.removed} detailed=${r.detailed} texts=${r.texts} ${r.seconds.toFixed(1)}s${r.error ? " " + r.error : ""}`,
  );
  // shows up as an annotation on the workflow run
  if (process.env.GITHUB_ACTIONS && r.status !== "success") console.log(`::warning title=scrape ${r.slug}::${r.status}: ${r.error}`);
}

let results: ScrapeResult[] = [];
if (due) {
  const summary = await scrapeDue({ budgetMs: DUE_BUDGET_MS, onResult: report });
  results = summary.results;
  console.log(`due ${summary.due}, scraped ${summary.ran}, deferred to the next run ${summary.deferred}`);
} else {
  const companies = await loadCompanies(slugs);
  if (companies.length === 0) console.log("no matching companies");
  results = (await scrapeMany(companies, { backfill, force, fill: texts ? ALL_TEXTS : undefined, onResult: report })).results;
}

const failed = results.filter((r) => r.status === "failed").length;
const held = results.filter((r) => r.status === "partial").length;
const stored = results.reduce((sum, r) => sum + r.texts, 0);
console.log(`${results.length} scraped, ${failed} failed, ${held} held back by the result guard, ${stored} listing texts stored`);

// Housekeeping after full runs only (a run for a few slugs leaves it alone). It must never fail the run.
if (due || (texts && slugs.length === 0)) {
  try {
    const h = await housekeeping();
    console.log(`housekeeping: ${h.runs} old scrape runs deleted, ${h.closed} jobs of switched-off companies closed, ${h.texts} listing texts dropped`);
  } catch (err) {
    console.log(`::warning title=housekeeping::${err instanceof Error ? err.message : String(err)}`);
  }
}

// One company being down is normal. More than half failing at once means something systemic (blocked IP, network), so fail the run.
if (results.length >= 5 && failed > results.length / 2) {
  console.error("more than half of the scrapes failed");
  process.exitCode = 1;
}

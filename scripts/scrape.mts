import { loadCompanies, scrapeCompany, scrapeDue, type ScrapeResult } from "../lib/scrape.ts";

// npm run scrape                     every active company, one after the other
// npm run scrape -- <slug> [slug…]   just those companies
// npm run scrape -- --due            only companies whose interval has elapsed, four at a time (what the GitHub workflow runs)
// --backfill reads many more listing texts per company; --force skips the result guard (after a deliberate adapter change)
const args = process.argv.slice(2);
const backfill = args.includes("--backfill");
const force = args.includes("--force");
const due = args.includes("--due");
const slugs = args.filter((a) => !a.startsWith("--"));

const DUE_BUDGET_MS = 25 * 60_000; // the workflow times out at 30 minutes

function report(r: ScrapeResult) {
  console.log(
    `${r.slug.padEnd(26)} ${r.status.padEnd(8)} found=${r.found} added=${r.added} removed=${r.removed} detailed=${r.detailed} ${r.seconds.toFixed(1)}s${r.error ? " " + r.error : ""}`,
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
  for (const c of companies) {
    const r = await scrapeCompany(c, { backfill, force });
    results.push(r);
    report(r);
  }
}

const failed = results.filter((r) => r.status === "failed").length;
const held = results.filter((r) => r.status === "partial").length;
console.log(`${results.length} scraped, ${failed} failed, ${held} held back by the result guard`);
// One company being down is normal. More than half failing at once means something systemic (blocked IP, network), so fail the run.
if (results.length >= 5 && failed > results.length / 2) {
  console.error("more than half of the scrapes failed");
  process.exitCode = 1;
}

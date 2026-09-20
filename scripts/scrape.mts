import { loadCompanies, scrapeCompany } from "../lib/scrape.ts";

const args = process.argv.slice(2);
const backfill = args.includes("--backfill");
const slugs = args.filter((a) => !a.startsWith("--"));

const companies = await loadCompanies(slugs);
if (companies.length === 0) console.log("no matching companies");
for (const c of companies) {
  const t = Date.now();
  const r = await scrapeCompany(c, { backfill });
  console.log(
    `${r.slug.padEnd(16)} ${r.status.padEnd(8)} found=${r.found} added=${r.added} removed=${r.removed} detailed=${r.detailed} ${((Date.now() - t) / 1000).toFixed(1)}s${r.error ? " ERROR: " + r.error : ""}`,
  );
}

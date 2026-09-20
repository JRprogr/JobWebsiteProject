import { loadCompanies, scrapeCompany } from "../lib/scrape.ts";

const companies = await loadCompanies(process.argv.slice(2));
if (companies.length === 0) console.log("no matching companies");
for (const c of companies) {
  const t = Date.now();
  const r = await scrapeCompany(c);
  console.log(`${r.slug.padEnd(16)} ${r.status.padEnd(8)} found=${r.found} added=${r.added} removed=${r.removed} ${((Date.now() - t) / 1000).toFixed(1)}s${r.error ? " ERROR: " + r.error : ""}`);
}

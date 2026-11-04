import aliases from "../db/seed/link-aliases.json" with { type: "json" };
import { politeFetch } from "../lib/adapters/http.ts";
import { sql } from "../lib/db.ts";
import { sleep } from "../lib/pool.ts";
import { companyIds, syncCuratedLinks } from "../lib/linkSync.ts";
import { importTed } from "./linksTed.mts";

// `npm run links [curated|usaspending|ted]` fills company_links. Run by hand (or the "Company links" workflow), never by the web app.
// usaspending: for every company in db/seed/link-aliases.json, the biggest subawards it RECEIVED in the last five years
// (USAspending.gov, public domain, no key) give "prime contractor -> this company" links, aggregated per prime. A prime that is
// itself a register company becomes a link between two register companies; any other prime becomes an outside company, kept
// only when it is one of the biggest for that company so the map stays readable.

const API = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const YEARS = 5;
const PAGES = 3; // of 100 subawards each, biggest first (the API is slow: one search can take a minute and a half)
const EXTERNAL_PER_COMPANY = 5;
// The API answers 503 now and then (and slowly under load), more so from a cloud runner and when asked quickly one request after
// the other: ask gently, and when a search still fails wait longer and ask again before giving up on that company.
const PAUSE_MS = 1_500;
const ATTEMPTS = 4;
const GIVE_UP_AFTER = 3; // companies in a row that failed after every attempt: the API is down, stop asking
const EXTERNAL_MIN_USD = 500_000;

type Alias = { terms?: string[]; exclude?: string[]; ted?: string[] };
const ALIASES = aliases as Record<string, Alias>;

type Row = { sub: string; prime: string; amount: number; date: string | null };

async function fetchSubawards(term: string): Promise<Row[]> {
  const end = new Date();
  const start = new Date(end.getFullYear() - YEARS, end.getMonth(), end.getDate());
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const res = await politeFetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        subawards: true,
        filters: { recipient_search_text: [term], award_type_codes: ["A", "B", "C", "D"], time_period: [{ start_date: day(start), end_date: day(end) }] },
        fields: ["Sub-Awardee Name", "Sub-Award Amount", "Prime Recipient Name", "Sub-Award Date"],
        sort: "Sub-Award Amount",
        order: "desc",
        limit: 100,
        page,
      }),
    });
    if (!res.ok) throw new Error(`USAspending answered ${res.status} for "${term}": ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)}`);
    const body = (await res.json()) as { results: Record<string, unknown>[]; page_metadata: { hasNext: boolean } };
    for (const r of body.results) {
      rows.push({
        sub: String(r["Sub-Awardee Name"] ?? ""),
        prime: String(r["Prime Recipient Name"] ?? ""),
        amount: Number(r["Sub-Award Amount"] ?? 0),
        date: typeof r["Sub-Award Date"] === "string" ? (r["Sub-Award Date"] as string).slice(0, 10) : null,
      });
    }
    if (!body.page_metadata.hasNext) break;
    await sleep(PAUSE_MS);
  }
  return rows;
}

async function fetchWithRetry(term: string): Promise<Row[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchSubawards(term);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // a request the API refuses for good (400, 404...) is not worth asking again; 429, 5xx, timeouts and dropped connections are
      if (attempt === ATTEMPTS || /answered 4(?!29)/.test(message)) throw err;
      const wait = 20 * attempt;
      console.log(`retry ${attempt}/${ATTEMPTS - 1} for "${term}" in ${wait} s: ${message.slice(0, 120)}`);
      await sleep(wait * 1000);
    }
  }
}

const upper = (s: string) => s.toUpperCase();
function slugOf(name: string): string | null {
  const n = upper(name);
  for (const [slug, a] of Object.entries(ALIASES)) {
    if (a.exclude?.some((x) => n.includes(x))) continue;
    if (a.terms?.some((t) => n.includes(t))) return slug;
  }
  return null;
}

// "NORTHROP GRUMMAN SYSTEMS CORPORATION" and "NORTHROP GRUMMAN CORP" are one outside company
const SUFFIX = /\b(?:INC|LLC|L\.?L\.?C|L\.?P|LP|LTD|LIMITED|CORPORATION|CORP|COMPANY|CO|INCORPORATED|THE|PLC)\b\.?/g;
function clean(name: string): string {
  return upper(name).replace(/[.,]/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
}
const key = (clean: string) => clean.split(" ").slice(0, 2).join(" ");
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

type Agg = { primeSlug: string | null; primeName: string; amount: number; count: number; first: string | null; last: string | null; bestAmount: number };

async function usaspending() {
  const db = sql();
  const ids = await companyIds();
  const stamp: string[] = [];
  const done: string[] = []; // companies whose search worked: only their old links are replaced
  const failed: string[] = [];
  let inARow = 0;
  // `npm run links usaspending spacex boeing-space` asks only for those companies (the retry after a partial run)
  const only = new Set(process.argv.slice(3));
  const inserts: { from: string | null; fromName: string | null; to: string; amount: number; count: number; first: string | null; last: string | null; term: string }[] = [];

  for (const [slug, alias] of Object.entries(ALIASES)) {
    if (!alias.terms || (only.size > 0 && !only.has(slug))) continue;
    const to = ids.get(slug);
    if (!to) {
      console.log(`skip ${slug}: not in the register`);
      continue;
    }
    const byPrime = new Map<string, Agg>();
    const rows: Row[] = [];
    try {
      for (const term of alias.terms) rows.push(...(await fetchWithRetry(term)));
    } catch (err) {
      failed.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`FAILED ${slug}: ${failed.at(-1)}`);
      if (++inARow >= GIVE_UP_AFTER) {
        failed.push("stopped: three companies in a row failed, USAspending seems to be down");
        break;
      }
      continue;
    }
    inARow = 0;
    done.push(to);
    for (const r of rows) {
      // only subawards that really went to this company (the search also matches the prime name)
      if (slugOf(r.sub) !== slug) continue;
      const primeSlug = slugOf(r.prime);
      if (primeSlug === slug) continue;
      const name = clean(r.prime);
      const k = primeSlug ?? `ext:${key(name)}`;
      const a = byPrime.get(k) ?? { primeSlug, primeName: name, amount: 0, count: 0, first: null, last: null, bestAmount: 0 };
      a.amount += r.amount;
      a.count++;
      if (r.amount > a.bestAmount) {
        a.bestAmount = r.amount;
        a.primeName = name;
      }
      if (r.date && (!a.first || r.date < a.first)) a.first = r.date;
      if (r.date && (!a.last || r.date > a.last)) a.last = r.date;
      byPrime.set(k, a);
  }
    const all = [...byPrime.values()].sort((x, y) => y.amount - x.amount);
    const register = all.filter((a) => a.primeSlug);
    const outside = all.filter((a) => !a.primeSlug && a.amount >= EXTERNAL_MIN_USD).slice(0, EXTERNAL_PER_COMPANY);
    for (const a of [...register, ...outside]) {
      inserts.push({
        from: a.primeSlug ? (ids.get(a.primeSlug) ?? null) : null,
        fromName: a.primeSlug ? null : titleCase(a.primeName),
        to,
        amount: Math.round(a.amount),
        count: a.count,
        first: a.first,
        last: a.last,
        term: slug,
      });
    }
    stamp.push(`${slug}: ${register.length} register + ${outside.length} outside primes`);
    console.log(stamp.at(-1));
  }

  await db.transaction([
    db.query("delete from company_links where origin = 'usaspending' and to_company = any($1::uuid[])", [done]),
    ...inserts.map((l) =>
      db.query(
        `insert into company_links (from_company, from_name, to_company, kind, origin, weight, amount_usd, first_date, last_date, source_url, note)
         values ($1, $2, $3, 'contract', 'usaspending', $4, $5, $6, $7, 'https://www.usaspending.gov/search', $8)
         on conflict (coalesce(from_company::text, from_name), coalesce(to_company::text, to_name), kind, origin) do update
           set weight = company_links.weight + excluded.weight, amount_usd = company_links.amount_usd + excluded.amount_usd,
               first_date = least(company_links.first_date, excluded.first_date), last_date = greatest(company_links.last_date, excluded.last_date)`,
        [l.from, l.fromName, l.to, l.count, l.amount, l.first, l.last, `Subcontracts under US federal prime contracts (${YEARS} years, biggest first).`],
      ),
    ),
  ]);
  console.log(`stored ${inserts.length} USAspending links`);
  if (failed.length) throw new Error(`USAspending failed for ${failed.length} ${failed.length === 1 ? "company" : "companies"} (their old links were kept): ${failed.join(" | ")}`);
}

const what = process.argv[2] ?? "all";
const problems: string[] = [];

// A source that fails must not stop the others, and its reason must be readable without opening the log: the ::error:: line shows up
// as an annotation on the run's summary page.
async function step(name: string, run: () => Promise<void>) {
  const started = Date.now();
  try {
    await run();
    console.log(`${name}: done in ${Math.round((Date.now() - started) / 1000)} s`);
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 900);
    problems.push(`${name}: ${message}`);
    console.log(`::error title=${name} failed::${message}`);
    console.error(err);
  }
}

// migrations 008 and 009 run with the deploy; a database that has not seen them yet needs a deploy first
const present = await sql().query("select to_regclass('public.company_links') as t, (select count(*) from information_schema.columns where table_name = 'company_links' and column_name in ('currency', 'from_type', 'to_type'))::int as c");
if (!present[0].t || present[0].c < 3) {
  console.log("::error title=company_links is missing::Migrations 008 and 009 have not run on this database. Deploy first (the production build runs the migrations), then run this again.");
  process.exit(1);
}

if (what === "curated" || what === "all") await step("curated links", async () => console.log(`synced ${await syncCuratedLinks()} curated links`));
if (what === "usaspending" || what === "all") await step("USAspending", usaspending);
if (what === "ted" || what === "all") await step("TED", importTed);
if (problems.length) {
  console.log(`${problems.length} of the sources failed`);
  process.exit(1);
}

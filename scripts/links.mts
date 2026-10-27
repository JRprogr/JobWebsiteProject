import aliases from "../db/seed/link-aliases.json" with { type: "json" };
import { USER_AGENT } from "../lib/adapters/http.ts";
import { sql } from "../lib/db.ts";
import { companyIds, syncCuratedLinks } from "../lib/linkSync.ts";
import { importTed } from "./linksTed.mts";

// `npm run links [curated|usaspending|ted]` fills company_links. Run by hand (or the "Company links" workflow), never by the web app.
// usaspending: for every company in db/seed/link-aliases.json, the biggest subawards it RECEIVED in the last five years
// (USAspending.gov, public domain, no key) give "prime contractor -> this company" links, aggregated per prime. A prime that is
// itself a register company becomes a link between two register companies; any other prime becomes an outside company, kept
// only when it is one of the biggest for that company so the map stays readable.

const API = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const YEARS = 5;
const PAGES = 5; // of 100 subawards each, biggest first
const EXTERNAL_PER_COMPANY = 5;
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
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
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
    if (!res.ok) throw new Error(`USAspending answered ${res.status} for "${term}"`);
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
  }
  return rows;
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
  const inserts: { from: string | null; fromName: string | null; to: string; amount: number; count: number; first: string | null; last: string | null; term: string }[] = [];

  for (const [slug, alias] of Object.entries(ALIASES)) {
    if (!alias.terms) continue;
    const to = ids.get(slug);
    if (!to) {
      console.log(`skip ${slug}: not in the register`);
      continue;
    }
    const byPrime = new Map<string, Agg>();
    for (const term of alias.terms) {
      for (const r of await fetchSubawards(term)) {
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
    db.query("delete from company_links where origin = 'usaspending'"),
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
}

const what = process.argv[2] ?? "all";
if (what === "curated" || what === "all") console.log(`synced ${await syncCuratedLinks()} curated links`);
if (what === "usaspending" || what === "all") await usaspending();
if (what === "ted" || what === "all") await importTed();

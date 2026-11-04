import aliases from "../db/seed/link-aliases.json" with { type: "json" };
import { politeFetch } from "../lib/adapters/http.ts";
import { sql } from "../lib/db.ts";
import { sleep } from "../lib/pool.ts";

// TED (Tenders Electronic Daily, ted.europa.eu): contract award notices of public buyers across Europe, free API without a key.
// For every European company on the board (name or the `ted` search names in db/seed/link-aliases.json) the notices of the last
// four years that name it as a winner become "buyer -> company" contract links, aggregated per buyer; notices with two register
// companies among the winners give "partnership" links (a joint award). ESA is not on TED (it buys under its own rules), so its
// programme contracts are curated in db/seed/links.json.

const API = "https://api.ted.europa.eu/v3/notices/search";
const SINCE = `${new Date().getFullYear() - 4}0101`;
const PAGE = 100;
const MAX_PAGES = 3;
const BUYERS_PER_COMPANY = 6;
const EUROPE = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE NO IS LI GB CH AL BA ME MK RS XK".split(" "));

type Alias = { terms?: string[]; exclude?: string[]; ted?: string[] };
const ALIASES = aliases as Record<string, Alias>;

type Notice = {
  "publication-number": string;
  "publication-date"?: string;
  "buyer-name"?: Record<string, string[]>;
  "winner-name"?: Record<string, string[]>;
  "total-value"?: number;
  "total-value-cur"?: string[];
  "notice-title"?: Record<string, string>;
};

// upper case, no accents or punctuation: "Leonardo S.p.A." and "LEONARDO SPA" meet
const norm = (s: string) => ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim()} `;

// buyers that are register companies (agencies), by the way they spell themselves
const BUYER_SLUGS: [RegExp, string][] = [
  [/DEUTSCHE RAUMFAHRTAGENTUR/, "dlr"],
  [/EUROPEAN UNION AGENCY FOR THE SPACE PROGRAMME|EUSPA|EUROPEAN GNSS AGENCY/, "euspa"],
  [/EUROPEAN SPACE AGENCY|ESA ESTEC|ESTEC|ESRIN/, "esa"],
  [/CENTRE NATIONAL D ETUDES SPATIALES|\bCNES\b/, "cnes"],
  [/DEUTSCHES ZENTRUM FUR LUFT|\bDLR\b/, "dlr"],
  [/LUXEMBOURG SPACE AGENCY/, "luxembourg-space-agency"],
  [/NETHERLANDS AEROSPACE CENTRE|NATIONAAL LUCHT/, "netherlands-aerospace-centre-nlr"],
];

// Only buyers of space and defence count: a ministry of defence, a space or research agency, the Commission's space and defence directorate...
// (a power utility or a motorway company that bought IT from the same group is not part of this picture)
const RELEVANT = /DEFEN[CS]E|DEFENSA|DIFESA|DEFESA|ARMEE|ARMAMENT|ARMEMENT|ARMED FORCES|BUNDESWEHR|VERTEIDIGUNG|FORSVAR|FORSVARS|FORSVARET|FORTIFIKATION|FMV|KAITSE|AIZSARDZ|GYNYBOS|APSAUGOS|OBRANY|OBRONY|NATO|MILIT|SPACE|SPATIAL|SPAZIAL|ESPACIAL|RAUMFAHRT|AEROSPACE|AEROSPAZIO|AERONAUT|LUFT|ONERA|DLR|CNES|ESA|EUSPA|GNSS|DG DEFIS|DEFIS|DGA|OSSERVATORIO|OBSERVATOIRE|OBSERVATORY|ASTRONOM|ASTROFISICA|ASTROPHYS|COPERNICUS|EUROPEAN COMMISSION|EUROPEAN DEFENCE AGENCY|MARITIME SAFETY|FRONTEX|HYDROGRAPH|MARINE/;
const pick = (o: Record<string, string[]> | undefined): string[] => {
  if (!o) return [];
  const list = o.eng ?? Object.values(o)[0] ?? [];
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))];
};

export async function search(term: string): Promise<Notice[]> {
  const out: Notice[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await politeFetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `winner-name="${term.replace(/"/g, "")}" AND publication-date>=${SINCE}`,
        fields: ["publication-number", "publication-date", "buyer-name", "winner-name", "total-value", "total-value-cur", "notice-title"],
        limit: PAGE,
        page,
        scope: "ALL",
        paginationMode: "PAGE_NUMBER",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    // politeFetch already waited and retried on 429 and 5xx; what is left is worth reading
    if (!res.ok) throw new Error(`TED answered ${res.status} for "${term}": ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)}`);
    const body = (await res.json()) as { notices?: Notice[]; totalNoticeCount?: number };
    out.push(...(body.notices ?? []));
    if ((body.notices ?? []).length < PAGE) break;
    await sleep(300);
  }
  return out;
}

type Agg = { buyer: string; slug: string; buyerSlug: string | null; count: number; eur: number; first: string; last: string; best: { value: number; pub: string; title: string } };

export async function importTed() {
  const db = sql();
  const rows = await db.query("select id, slug, name, hq_country, classification from companies");
  const ids = new Map(rows.map((r) => [String(r.slug), String(r.id)]));

  // slug -> the names it is searched and recognised by
  const terms = new Map<string, string[]>();
  for (const r of rows) {
    const slug = String(r.slug);
    const explicit = ALIASES[slug]?.ted;
    if (explicit) {
      if (explicit.length) terms.set(slug, explicit);
      continue;
    }
    if (!EUROPE.has(String(r.hq_country)) || r.classification === "institutions" || String(r.name).length < 5) continue;
    terms.set(slug, [String(r.name)]);
  }
  const recognise = (name: string): string | null => {
    const n = norm(name);
    let best: [string, number] | null = null;
    for (const [slug, list] of terms) for (const t of list) {
      const nt = norm(t);
      if (n.includes(nt) && (!best || nt.length > best[1])) best = [slug, nt.length];
    }
    return best?.[0] ?? null;
  };

  const notices = new Map<string, Notice>();
  let done = 0;
  for (const [slug, list] of terms) {
    for (const term of list) {
      for (const n of await search(term)) notices.set(n["publication-number"], n);
    }
    console.log(`${String(++done).padStart(3)}/${terms.size} ${slug}: ${notices.size} notices so far`);
    await sleep(200);
  }

  const byEdge = new Map<string, Agg>();
  const joint = new Map<string, { a: string; b: string; count: number; first: string; last: string; pub: string }>();
  for (const n of notices.values()) {
    const winners = new Set<string>();
    for (const w of Object.values(n["winner-name"] ?? {}).flat()) {
      const slug = recognise(w);
      if (slug) winners.add(slug);
    }
    if (winners.size === 0) continue;
    const buyer = pick(n["buyer-name"])[0];
    if (!buyer) continue;
    const date = (n["publication-date"] ?? "").slice(0, 10);
    const value = n["total-value-cur"]?.[0] === "EUR" ? (n["total-value"] ?? 0) : 0;
    const title = (n["notice-title"]?.eng ?? Object.values(n["notice-title"] ?? {})[0] ?? "").replace(/^[^–-]*[–-]\s*[^–-]*[–-]\s*/, "").slice(0, 140);
    const nb = norm(buyer);
    const buyerSlug = BUYER_SLUGS.find(([re]) => re.test(nb.trim()))?.[1] ?? null;
    if (!buyerSlug && !RELEVANT.test(nb)) continue;
    for (const slug of winners) {
      const key = `${buyerSlug ?? nb}|${slug}`;
      const a = byEdge.get(key) ?? { buyer, slug, buyerSlug, count: 0, eur: 0, first: date, last: date, best: { value: -1, pub: "", title: "" } };
      a.count++;
      a.eur += value;
      if (date && date < a.first) a.first = date;
      if (date > a.last) a.last = date;
      if (value > a.best.value || (a.best.value < 0 && !a.best.pub)) a.best = { value, pub: n["publication-number"], title };
      byEdge.set(key, a);
    }
    const list = [...winners].sort();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const key = `${list[i]}|${list[j]}`;
      const g = joint.get(key) ?? { a: list[i], b: list[j], count: 0, first: date, last: date, pub: n["publication-number"] };
      g.count++;
      if (date && date < g.first) g.first = date;
      if (date > g.last) g.last = date;
      joint.set(key, g);
    }
  }

  // per company: every agency of the register, plus its biggest other buyers
  const perCompany = new Map<string, Agg[]>();
  for (const a of byEdge.values()) perCompany.set(a.slug, [...(perCompany.get(a.slug) ?? []), a]);
  const keep: Agg[] = [];
  for (const list of perCompany.values()) {
    const rank = (a: Agg) => a.eur + a.count * 50_000;
    list.sort((x, y) => rank(y) - rank(x));
    // a one-off notice from a small buyer is not a relationship worth a line on the map
    const worth = (a: Agg) => a.count >= 2 || a.best.value >= 3_000_000;
    keep.push(...list.filter((a) => a.buyerSlug), ...list.filter((a) => !a.buyerSlug && worth(a)).slice(0, BUYERS_PER_COMPANY));
  }

  const ted = (pub: string) => `https://ted.europa.eu/en/notice/-/detail/${pub}`;
  const statements = [
    db.query("delete from company_links where origin = 'ted'"),
    ...keep.map((a) => {
      const fc = a.buyerSlug ? (ids.get(a.buyerSlug) ?? null) : null;
      const fn = fc ? null : a.buyer.replace(/^Auftraggeber ist die /, "").slice(0, 80);
      // the value on a notice is the whole notice (every lot and winner), so it is only quoted for the largest one, not summed
      const value = a.best.value > 0 ? ` (notice value €${a.best.value >= 1e6 ? Math.round(a.best.value / 1e6) + "M" : Math.round(a.best.value / 1e3) + "k"}, all lots)` : "";
      const note = `${a.count} contract award ${a.count === 1 ? "notice" : "notices"} on TED${a.best.title ? `; largest: ${a.best.title}${value}` : ""}.`;
      return db.query(
        `insert into company_links (from_company, from_name, from_type, to_company, kind, origin, weight, amount_usd, currency, first_date, last_date, source_url, note)
         values ($1, $2, $3, $4, 'contract', 'ted', $5, $6, 'EUR', $7, $8, $9, $10)
         on conflict (coalesce(from_company::text, from_name), coalesce(to_company::text, to_name), kind, origin) do nothing`,
        [fc, fn, fc ? null : "buyer", ids.get(a.slug), a.count, null, a.first || null, a.last || null, a.best.pub ? ted(a.best.pub) : null, note],
      );
    }),
    ...[...joint.values()].map((g) =>
      db.query(
        `insert into company_links (from_company, to_company, kind, origin, weight, first_date, last_date, source_url, note)
         values ($1, $2, 'partnership', 'ted', $3, $4, $5, $6, $7)
         on conflict (coalesce(from_company::text, from_name), coalesce(to_company::text, to_name), kind, origin) do nothing`,
        [ids.get(g.a), ids.get(g.b), g.count, g.first || null, g.last || null, ted(g.pub), `Named together as winners of ${g.count} public contract ${g.count === 1 ? "notice" : "notices"} on TED.`],
      ),
    ),
  ];
  await db.transaction(statements);
  console.log(`TED: ${notices.size} notices read, ${keep.length} buyer links and ${joint.size} joint-award links stored`);
}

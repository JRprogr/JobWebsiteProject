import { sql } from "./db.ts";
import type { LinkKind, MarketData, MarketLink, MarketNode } from "./marketTypes.ts";

type Row = Record<string, unknown>;

// Nodes: every company on the board that is being collected, plus any other register company that has a link, plus the outside
// companies (not on the board) that appear in a link. Links come from company_links (see scripts/links.mts).
export async function loadMarket(): Promise<MarketData> {
  const db = sql();
  const [companies, links] = await Promise.all([
    db.query(
      `select c.id, c.slug, c.name, c.classification, c.hq_country, c.logo_url, c.active, coalesce(j.n, 0) as roles
       from companies c
       left join (select company_id, count(*)::int as n from jobs where removed_at is null group by company_id) j on j.company_id = c.id`,
    ),
    db.query(
      `select id, from_company, from_name, from_type, to_company, to_name, to_type, kind, origin, year, weight, amount_usd, currency, first_date, last_date, note, source_url
       from company_links`,
    ),
  ]);

  const linked = new Set<string>();
  const outside = new Map<string, MarketNode>();
  const endpoint = (company: unknown, name: unknown, type: unknown): string => {
    if (company) {
      linked.add(String(company));
      return String(company);
    }
    const id = `x:${String(name)}`;
    const known = outside.get(id);
    if (!known) outside.set(id, { id, slug: null, name: String(name), classification: null, country: null, logo: null, roles: 0, active: false, type: type === "buyer" || type === "agency" ? "buyer" : "company" });
    else if (type === "buyer" || type === "agency") known.type = "buyer";
    return id;
  };

  const out: MarketLink[] = (links as Row[]).map((r) => ({
    id: String(r.id),
    source: endpoint(r.from_company, r.from_name, r.from_type),
    target: endpoint(r.to_company, r.to_name, r.to_type),
    kind: String(r.kind) as LinkKind,
    origin: String(r.origin) as MarketLink["origin"],
    currency: (r.currency as string | null) ?? "USD",
    year: (r.year as number | null) ?? null,
    weight: Number(r.weight),
    amountUsd: r.amount_usd === null ? null : Number(r.amount_usd),
    firstDate: r.first_date ? new Date(r.first_date as string).toISOString().slice(0, 10) : null,
    lastDate: r.last_date ? new Date(r.last_date as string).toISOString().slice(0, 10) : null,
    note: (r.note as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
  }));

  const nodes: MarketNode[] = (companies as Row[])
    .filter((c) => Boolean(c.active) || linked.has(String(c.id)))
    .map((c) => ({
      id: String(c.id),
      slug: String(c.slug),
      name: String(c.name),
      classification: (c.classification as string | null) ?? null,
      country: (c.hq_country as string | null) ?? null,
      logo: (c.logo_url as string | null) ?? null,
      roles: c.roles as number,
      active: Boolean(c.active),
      type: "company" as const,
    }));

  return { nodes: [...nodes, ...outside.values()], links: out };
}

// Shared by lib/market.ts (server) and the Market Insight page (browser): no database import here.

export const LINK_KINDS = [
  { key: "ownership", label: "OWNERSHIP / ACQUISITION", short: "OWNS" },
  { key: "joint_venture", label: "JOINT VENTURE", short: "JV" },
  { key: "contract", label: "CONTRACT", short: "CONTRACT" },
  { key: "partnership", label: "PARTNERSHIP", short: "PARTNER" },
] as const;

export type LinkKind = (typeof LINK_KINDS)[number]["key"];

export const linkKindLabel = (key: string) => LINK_KINDS.find((k) => k.key === key)?.label ?? key.toUpperCase();

export type MarketNode = {
  id: string; // company id, or "x:<name>" for a company that is not on the board
  slug: string | null;
  name: string;
  classification: string | null; // null = not on the board
  country: string | null;
  logo: string | null;
  roles: number;
  active: boolean; // false: listed in the register but its openings are not collected
  type: "company" | "buyer"; // buyer: a public buyer or agency that is not on the board (ministry, the Commission...)
};

export type MarketLink = {
  id: string;
  source: string; // node id
  target: string;
  kind: LinkKind;
  origin: "curated" | "usaspending" | "ted";
  currency: string;
  year: number | null;
  weight: number;
  amountUsd: number | null;
  firstDate: string | null;
  lastDate: string | null;
  note: string | null;
  sourceUrl: string | null;
};

export type MarketData = { nodes: MarketNode[]; links: MarketLink[] };

export function formatUsd(n: number | null, symbol = "$"): string | null {
  if (n === null) return null;
  if (n >= 1e9) return `${symbol}${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${symbol}${Math.round(n / 1e6)}M`;
  return `${symbol}${Math.round(n / 1e3)}k`;
}

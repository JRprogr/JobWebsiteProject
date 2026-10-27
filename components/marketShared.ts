import { CLASSIFICATIONS, classificationLabel } from "@/lib/classifications";
import { formatUsd, type MarketLink, type MarketNode } from "@/lib/marketTypes";

// Shared by the views of the Market Insight page

export type Colors = { fg: string; dim: string; line: string; bg: string; accent: string; node: string; nodeActive: string };

// What a view paints with: CSS variables, which HTML and SVG take as they are. A canvas needs real colours, so it calls readColors()
export const CSS_COLORS: Colors = { fg: "var(--fg)", dim: "var(--dim)", line: "var(--line)", bg: "var(--bg)", accent: "var(--accent)", node: "var(--map)", nodeActive: "var(--map-selected)" };

export const readColors = (): Colors => {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  // text and rings keep the page colours; nodes and arrows take the terminal colour of the globe (green at night, red by day)
  return {
    fg: v("--fg", "#003399"),
    dim: v("--dim", "#335"),
    line: v("--line", "#99a"),
    bg: v("--bg", "#fff"),
    accent: v("--accent", "#003399"),
    node: v("--map", "#33ff99"),
    nodeActive: v("--map-selected", "#d9ffea"),
  };
};

// What a node belongs to: one of the ten classifications, or one of two groups for what is not on the board
export const OUTSIDE = "outside";
export const BUYERS = "buyers";

export const groupOf = (n: MarketNode): string => (n.slug ? (n.classification ?? OUTSIDE) : n.type === "buyer" ? BUYERS : OUTSIDE);

export const groupLabel = (key: string): string => (key === OUTSIDE ? "COMPANIES NOT ON THE BOARD" : key === BUYERS ? "PUBLIC BUYERS & AGENCIES" : classificationLabel(key));

export const GROUPS = [...CLASSIFICATIONS.map((c) => c.key as string), BUYERS, OUTSIDE];

// One line on a link: how many contracts or notices, what they were worth, and when
export function linkFacts(l: MarketLink): string {
  const parts: string[] = [];
  if (l.origin === "usaspending") {
    parts.push(`${l.weight} ${l.weight === 1 ? "subcontract" : "subcontracts"}`);
    const usd = formatUsd(l.amountUsd);
    if (usd) parts.push(usd);
    if (l.firstDate && l.lastDate) parts.push(`${l.firstDate.slice(0, 4)}–${l.lastDate.slice(0, 4)}`);
  } else if (l.origin === "ted") {
    parts.push(`${l.weight} ${l.weight === 1 ? "notice" : "notices"} on TED`);
    if (l.firstDate && l.lastDate) parts.push(l.firstDate.slice(0, 4) === l.lastDate.slice(0, 4) ? l.firstDate.slice(0, 4) : `${l.firstDate.slice(0, 4)}–${l.lastDate.slice(0, 4)}`);
  } else if (l.year) {
    parts.push(String(l.year));
  }
  return parts.join(" · ");
}

// Only addresses that start with https:// become links: the text comes from the database, which also holds what third-party sources sent
export const safeUrl = (u: string | null): string | null => (u && /^https:\/\//i.test(u) ? u : null);

export const ORIGIN_LABEL: Record<MarketLink["origin"], string> = { curated: "PUBLIC ANNOUNCEMENT", usaspending: "USASPENDING.GOV", ted: "TED · EU PROCUREMENT" };

export type ViewProps = {
  nodes: MarketNode[]; // what is shown
  links: MarketLink[];
  allNodes: MarketNode[]; // everything, for layouts that must not move when a filter changes
  allLinks: MarketLink[];
  colors: Colors;
  theme: string; // changes when the theme does, so a canvas knows to read its colours again
  selectedId: string | null;
  hoverId: string | null;
  focusClass: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
};

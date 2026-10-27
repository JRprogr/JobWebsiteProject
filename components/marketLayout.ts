import { CLASSIFICATIONS } from "@/lib/classifications";
import type { MarketLink, MarketNode } from "@/lib/marketTypes";
import { BUYERS, GROUPS, groupOf, OUTSIDE } from "./marketShared";

// Static layout of the Market Insight graph: one cluster per classification on a ring, the public buyers and the companies that are
// not on the board in the middle (they connect several clusters), and a small force simulation inside that. Runs once in the browser on a fixed
// seed, so the picture is the same on every visit; filters only hide things, they never move them.

export type Placed = { id: string; x: number; y: number; r: number; cluster: string };
export type Cluster = { key: string; x: number; y: number; r: number; count: number };
export type Layout = { placed: Map<string, Placed>; clusters: Cluster[]; width: number; height: number };

const RING_X = 700;
const RING_Y = 430;

export const radiusOf = (n: MarketNode) => (n.slug ? 4.5 + Math.min(11, Math.sqrt(n.roles) * 0.75) : 6);

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeLayout(nodes: MarketNode[], links: MarketLink[]): Layout {
  const rnd = random(7);
  const centers = new Map<string, [number, number]>([
    [OUTSIDE, [-190, 0]],
    [BUYERS, [190, 0]],
  ]);
  CLASSIFICATIONS.forEach((c, i) => {
    const angle = -Math.PI / 2 + (i / CLASSIFICATIONS.length) * Math.PI * 2;
    centers.set(c.key, [Math.cos(angle) * RING_X, Math.sin(angle) * RING_Y]);
  });

  const items = nodes.map((n) => {
    const cluster = centers.has(groupOf(n)) ? groupOf(n) : OUTSIDE;
    const [cx, cy] = centers.get(cluster)!;
    return { id: n.id, cluster, r: radiusOf(n), x: cx + (rnd() - 0.5) * 120, y: cy + (rnd() - 0.5) * 120, vx: 0, vy: 0 };
  });
  const byId = new Map(items.map((p) => [p.id, p]));
  const edges = links.flatMap((l) => {
    const a = byId.get(l.source);
    const b = byId.get(l.target);
    return a && b && a !== b ? [{ a, b, same: a.cluster === b.cluster }] : [];
  });

  const TICKS = 320;
  for (let t = 0; t < TICKS; t++) {
    const alpha = Math.max(0.02, 1 - t / TICKS);
    for (const p of items) {
      const [cx, cy] = centers.get(p.cluster)!;
      const g = p.cluster === OUTSIDE || p.cluster === BUYERS ? 0.02 : 0.035;
      p.vx += (cx - p.x) * g * alpha;
      p.vy += (cy - p.y) * g * alpha;
    }
    for (const { a, b, same } of edges) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = (d - (same ? 40 : 260)) * (same ? 0.02 : 0.0025) * alpha;
      a.vx += (dx / d) * k;
      a.vy += (dy / d) * k;
      b.vx -= (dx / d) * k;
      b.vy -= (dy / d) * k;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 160 * 160) continue;
        if (d2 < 0.01) {
          dx = rnd() - 0.5;
          dy = rnd() - 0.5;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const gap = a.r + b.r + 5;
        const push = (d < gap ? (gap - d) * 0.7 : 0) + (a.cluster === b.cluster ? (a.cluster === OUTSIDE || a.cluster === BUYERS ? 420 : 120) : 260) / (d + 8);
        const fx = (dx / d) * push * 0.05;
        const fy = (dy / d) * push * 0.05;
        a.vx -= fx * 4;
        a.vy -= fy * 4;
        b.vx += fx * 4;
        b.vy += fy * 4;
      }
    }
    for (const p of items) {
      p.vx *= 0.6;
      p.vy *= 0.6;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  const placed = new Map<string, Placed>(items.map((p) => [p.id, { id: p.id, x: p.x, y: p.y, r: p.r, cluster: p.cluster }]));
  const clusters: Cluster[] = GROUPS.flatMap((key) => {
    const mine = items.filter((p) => p.cluster === key);
    if (mine.length === 0) return [];
    const x = mine.reduce((s, p) => s + p.x, 0) / mine.length;
    const y = mine.reduce((s, p) => s + p.y, 0) / mine.length;
    const r = Math.max(...mine.map((p) => Math.hypot(p.x - x, p.y - y) + p.r)) + 16;
    return [{ key, x, y, r, count: mine.length }];
  });

  const xs = items.map((p) => p.x);
  const ys = items.map((p) => p.y);
  return { placed, clusters, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

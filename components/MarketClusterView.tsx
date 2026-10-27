"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeLayout } from "./marketLayout";
import { groupLabel, groupOf, OUTSIDE, readColors, type ViewProps } from "./marketShared";

type View = { k: number; x: number; y: number };
const TAU = Math.PI * 2;
// room kept free around the diagram for the callouts that name each cluster
const CALLOUT_X = 190;
const CALLOUT_Y = 70;
const SLACK = 60;

// Variant 1, CLUSTERS: companies grouped by what they do, links drawn across. Drag to move, click a company.
export function MarketClusterView({ nodes, links, allNodes, allLinks, theme, selectedId, hoverId, focusClass, onHover, onSelect }: ViewProps) {
  const layout = useMemo(() => computeLayout(allNodes, allLinks), [allNodes, allLinks]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const adjacency = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of allLinks) {
      m.set(l.source, (m.get(l.source) ?? 0) + 1);
      m.set(l.target, (m.get(l.target) ?? 0) + 1);
    }
    return m;
  }, [allLinks]);

  const activeId = hoverId ?? selectedId;
  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (activeId) {
      s.add(activeId);
      for (const l of links) {
        if (l.source === activeId) s.add(l.target);
        if (l.target === activeId) s.add(l.source);
      }
    }
    return s;
  }, [activeId, links]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setSize({ w: canvas.clientWidth, h: canvas.clientHeight }));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const fit = useMemo(() => {
    if (size.w === 0) return null;
    const k = Math.min((size.w - 2 * CALLOUT_X) / (layout.width + 200), (size.h - 2 * CALLOUT_Y) / (layout.height + 200));
    return { k, x: size.w / 2, y: size.h / 2 } satisfies View;
  }, [size, layout]);
  const v = view ?? fit;

  // The diagram cannot be dragged out of the frame: when it is smaller than the frame it stays inside (with room for the callouts),
  // when it is larger (zoomed in) its edges cannot leave the frame.
  const bounds = useMemo(() => {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const c of layout.clusters) {
      b.x0 = Math.min(b.x0, c.x - c.r);
      b.x1 = Math.max(b.x1, c.x + c.r);
      b.y0 = Math.min(b.y0, c.y - c.r);
      b.y1 = Math.max(b.y1, c.y + c.r);
    }
    return b;
  }, [layout]);
  const clampView = (next: View): View => {
    // The diagram's extent includes the callouts around it (margin). Smaller than the frame: all of it stays inside. Larger (zoomed in):
    // you can pan until its far edge, callouts included, is in view, and no further than SLACK pixels beyond it.
    const axis = (pos: number, lo: number, hi: number, frame: number, margin: number) => {
      const a = pos + lo * next.k - margin;
      const b = pos + hi * next.k + margin;
      if (b - a <= frame) return pos + Math.max(0, -a) - Math.max(0, b - frame);
      return pos - Math.max(0, a - SLACK) + Math.max(0, frame - SLACK - b);
    };
    return { k: next.k, x: axis(next.x, bounds.x0, bounds.x1, size.w, CALLOUT_X), y: axis(next.y, bounds.y0, bounds.y1, size.h, CALLOUT_Y) };
  };

  const groupById = useMemo(() => new Map(allNodes.map((n) => [n.id, groupOf(n)])), [allNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !v || size.w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const font = getComputedStyle(canvas).fontFamily;
    const colors = readColors();
    // the halo behind every text is a stroke of the page colour; with the default miter join it grows a long spike at each sharp corner
    // of a letter (the apex of an A, the diagonal of an N), which showed as black scratches over the text
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    const at = (id: string) => layout.placed.get(id)!;
    const sx = (x: number) => v.x + x * v.k;
    const sy = (y: number) => v.y + y * v.k;
    const dimmed = (id: string) =>
      (activeId !== null && !neighbours.has(id)) || (focusClass !== null && groupById.get(id) !== focusClass && id !== activeId && !neighbours.has(id));

    // cluster rings and their names
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of layout.clusters) {
      const on = focusClass === null || focusClass === c.key;
      ctx.beginPath();
      ctx.arc(sx(c.x), sy(c.y), c.r * v.k, 0, TAU);
      ctx.fillStyle = colors.line;
      ctx.globalAlpha = (on ? 1 : 0.25) * 0.07;
      ctx.fill();
      ctx.globalAlpha = on ? 0.6 : 0.2;
      ctx.setLineDash(c.key === OUTSIDE ? [4, 4] : []);
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.line;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The name of each cluster as a callout in a technical drawing: a leader line from the edge of the circle, then a shelf with the
    // name above it, running outwards on the side the cluster sits on
    ctx.font = `700 10px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    for (const c of layout.clusters) {
      const on = focusClass === null || focusClass === c.key;
      const text = `${groupLabel(c.key)} · ${c.count}`;
      const away = Math.hypot(c.x, c.y);
      // the two clusters in the middle have no outside to point to: their leaders run down and sideways
      const [ux, uy] = away > 260 ? [c.x / away, c.y / away] : [c.key === OUTSIDE ? -0.5 : 0.5, 0.87];
      const side = ux >= 0 ? 1 : -1;
      const rr = c.r * v.k;
      const sxp = sx(c.x) + ux * rr;
      const syp = sy(c.y) + uy * rr;
      const ex = sxp + ux * 26;
      const ey = syp + uy * 26;
      const shelf = ctx.measureText(text).width + 10;
      ctx.globalAlpha = on ? 0.95 : 0.3;
      ctx.strokeStyle = colors.fg;
      ctx.fillStyle = colors.fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sxp, syp);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + side * shelf, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sxp, syp, 2.5, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.bg;
      const tx = side > 0 ? ex + 4 : ex - 4 - ctx.measureText(text).width;
      ctx.strokeText(text, tx, ey - 4);
      ctx.fillText(text, tx, ey - 4);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // links
    for (const l of links) {
      const a = at(l.source);
      const b = at(l.target);
      const faded = activeId !== null && l.source !== activeId && l.target !== activeId;
      ctx.globalAlpha = faded ? 0.07 : activeId ? 1 : l.kind === "contract" ? 0.4 : 0.85;
      ctx.strokeStyle = activeId && !faded ? colors.nodeActive : colors.node;
      // contracts are the thin lines, ownership and joint ventures the heavy ones
      ctx.lineWidth = l.kind === "contract" ? Math.min(1.8, 0.7 + Math.log10((l.amountUsd ?? 0) / 1e6 + 1) * 0.4) : l.kind === "partnership" ? 1.3 : 2.2;
      ctx.setLineDash(l.kind === "joint_venture" ? [7, 4] : l.kind === "partnership" ? [2, 4] : []);
      const x1 = sx(a.x);
      const y1 = sy(a.y);
      const x2 = sx(b.x);
      const y2 = sy(b.y);
      const mx = (x1 + x2) / 2 - (y2 - y1) * 0.08;
      const my = (y1 + y2) / 2 + (x2 - x1) * 0.08;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (l.kind === "ownership" || l.kind === "contract") {
        const ang = Math.atan2(y2 - my, x2 - mx);
        const tip = b.r * v.k + 1.5;
        const px = x2 - Math.cos(ang) * tip;
        const py = y2 - Math.sin(ang) * tip;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(ang - 0.45) * 8, py - Math.sin(ang - 0.45) * 8);
        ctx.lineTo(px - Math.cos(ang + 0.45) * 8, py - Math.sin(ang + 0.45) * 8);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }

    // nodes, then the labels that fit
    const labelled: { x: number; y: number; text: string; strong: boolean; rank: number }[] = [];
    for (const n of nodes) {
      const p = at(n.id);
      const x = sx(p.x);
      const y = sy(p.y);
      const r = Math.max(3, p.r * v.k);
      const isActive = n.id === activeId || n.id === selectedId;
      ctx.globalAlpha = dimmed(n.id) ? 0.18 : 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      if (n.slug && n.active) {
        ctx.fillStyle = isActive ? colors.nodeActive : colors.node;
        ctx.globalAlpha *= 0.9;
        ctx.fill();
      } else {
        // not collected (register only) or not on the board: a ring, so nobody reads it as a company with openings
        ctx.fillStyle = colors.bg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.setLineDash(n.slug ? [] : [3, 2]);
        ctx.strokeStyle = isActive ? colors.nodeActive : colors.node;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isActive) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.nodeActive;
        ctx.stroke();
      }
      const degree = adjacency.get(n.id) ?? 0;
      const show = isActive || neighbours.has(n.id) || v.k > 2.4 || (activeId === null && (n.roles >= 150 || degree >= (n.slug ? 4 : 7)));
      if (show && !dimmed(n.id)) labelled.push({ x, y: y + r + 9, text: n.name, strong: isActive, rank: isActive ? 1e9 : n.roles + degree * 5 });
    }
    ctx.globalAlpha = 1;
    ctx.font = `600 10px ${font}`;
    const taken: [number, number, number, number][] = [];
    labelled.sort((a, b) => b.rank - a.rank);
    for (const t of labelled) {
      const half = ctx.measureText(t.text).width / 2 + 2;
      const box: [number, number, number, number] = [t.x - half, t.y - 7, t.x + half, t.y + 7];
      if (!t.strong && taken.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
      taken.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.bg;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = colors.fg;
      ctx.fillText(t.text, t.x, t.y);
    }
  }, [theme, v, size, layout, nodes, links, activeId, neighbours, focusClass, selectedId, adjacency, groupById]);

  function nodeAt(px: number, py: number): string | null {
    if (!v) return null;
    let best: string | null = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const p = layout.placed.get(n.id)!;
      const d = Math.hypot(v.x + p.x * v.k - px, v.y + p.y * v.k - py);
      if (d <= Math.max(7, p.r * v.k + 4) && d < bestD) {
        best = n.id;
        bestD = d;
      }
    }
    return best;
  }
  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const zoom = (factor: number) => {
    if (!v) return;
    const k = Math.min(4, Math.max(fit ? fit.k * 0.8 : 0.3, v.k * factor));
    const ratio = k / v.k;
    setView(clampView({ k, x: size.w / 2 - (size.w / 2 - v.x) * ratio, y: size.h / 2 - (size.h / 2 - v.y) * ratio }));
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-[460px] w-full font-mono md:h-[640px]"
        style={{ touchAction: "pan-y", cursor: hoverId ? "pointer" : "grab" }}
        onPointerDown={(e) => {
          if (!v) return;
          const [x, y] = local(e);
          drag.current = { x, y, vx: v.x, vy: v.y, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const [x, y] = local(e);
          const d = drag.current;
          if (d) {
            if (Math.hypot(x - d.x, y - d.y) > 4) d.moved = true;
            if (d.moved && v) setView(clampView({ k: v.k, x: d.vx + x - d.x, y: d.vy + y - d.y }));
            return;
          }
          const id = nodeAt(x, y);
          if (id !== hoverId) onHover(id);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const [x, y] = local(e);
            onSelect(nodeAt(x, y));
          }
        }}
        onPointerLeave={() => onHover(null)}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        {[
          { label: "Zoom in", text: "+", run: () => zoom(1.3) },
          { label: "Zoom out", text: "−", run: () => zoom(1 / 1.3) },
          { label: "Reset view", text: "⌖", run: () => setView(null) },
        ].map((b) => (
          <button key={b.label} type="button" aria-label={b.label} onClick={b.run} className="grid size-8 place-items-center rounded-lg border border-line bg-[var(--bg)] font-mono text-sm leading-none">
            {b.text}
          </button>
        ))}
      </div>
      <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.08em] text-dim">DRAG TO MOVE · CLICK A COMPANY</p>
    </div>
  );
}

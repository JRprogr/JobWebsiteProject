"use client";

import { useState } from "react";
import type { DayPoint } from "@/lib/stats";

// Type-only import above: this component must not pull lib/stats.ts (and with it the database driver) into the browser bundle.
type Region = { key: string; label: string };
type View = "net" | "open";

const label = "font-mono text-[10px] tracking-[0.1em] text-dim";
const fmt = (n: number) => n.toLocaleString("en");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : "0");
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase();

const W = 720;
const H = 200;
const PAD = { l: 44, r: 12, t: 12, b: 24 };

const showLabel = (i: number, n: number) => i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;
const anchor = (i: number, n: number) => (i === 0 ? "start" : i === n - 1 ? "end" : "middle");

// Nice round tick step for a symmetric axis (1, 2, 5 × 10^k)
function niceMax(v: number): number {
  const m = Math.max(v, 1);
  const pow = 10 ** Math.floor(Math.log10(m));
  const f = m / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function NetChart({ points }: { points: DayPoint[] }) {
  const nets = points.map((p) => p.added - p.removed);
  const top = niceMax(Math.max(...nets.map(Math.abs)));
  const y = (v: number) => PAD.t + (1 - (v + top) / (2 * top)) * (H - PAD.t - PAD.b);
  const slot = (W - PAD.l - PAD.r) / points.length;
  const bar = Math.min(28, slot * 0.64);
  const cx = (i: number) => PAD.l + slot * (i + 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Net change in open roles per day: roles added minus roles removed">
      {[top, 0, -top].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" className="font-mono" fill="var(--dim)">
            {signed(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const net = nets[i];
        const y0 = y(0);
        const y1 = y(net);
        return (
          <g key={p.day}>
            <rect
              x={cx(i) - bar / 2}
              y={Math.min(y0, y1)}
              width={bar}
              height={Math.max(net === 0 ? 1.5 : 0, Math.abs(y1 - y0))}
              rx="2"
              fill={net >= 0 ? "var(--accent)" : "var(--fg)"}
              opacity={net >= 0 ? 1 : 0.45}
            >
              <title>{`${dayLabel(p.day)}: ${signed(p.added)} added, ${signed(-p.removed)} removed, net ${signed(net)}`}</title>
            </rect>
            {showLabel(i, points.length) ? (
              <text x={cx(i)} y={H - 6} textAnchor={anchor(i, points.length)} fontSize="10" className="font-mono" fill="var(--dim)">
                {dayLabel(p.day)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function OpenChart({ points }: { points: DayPoint[] }) {
  const max = Math.max(...points.map((p) => p.open));
  const min = Math.min(...points.map((p) => p.open));
  // zoom the axis onto the data so a few percent of change stays visible
  const span = Math.max(max - min, 1);
  const step = niceMax(span / 3);
  const lo = Math.max(0, Math.floor((min - span * 0.1) / step) * step);
  const hi = Math.max(lo + step, Math.ceil((max + span * 0.1) / step) * step);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.open).toFixed(1)}`).join("");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Open roles at the end of each day">
      {[lo, Math.round((lo + hi) / 2), hi].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" className="font-mono" fill="var(--dim)">
            {fmt(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.day}>
          <circle cx={x(i)} cy={y(p.open)} r="3" fill="var(--fg)">
            <title>{`${dayLabel(p.day)}: ${fmt(p.open)} open`}</title>
          </circle>
          {showLabel(i, points.length) ? (
            <text x={x(i)} y={H - 6} textAnchor={anchor(i, points.length)} fontSize="10" className="font-mono" fill="var(--dim)">
              {dayLabel(p.day)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

const pill = (on: boolean) => `rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em] ${on ? "border-fg bg-faint font-bold" : "border-line"}`;

export function Timeline({ regions, timeline }: { regions: Region[]; timeline: Record<string, DayPoint[]> }) {
  const [region, setRegion] = useState(regions[0].key);
  const [view, setView] = useState<View>("net");
  const points = timeline[region] ?? [];

  if (points.length < 2) {
    return <p className="font-mono text-xs leading-7 tracking-[0.06em] text-dim">HISTORY STARTS WITH THE FIRST REFRESH. THE CHART FILLS IN DAY BY DAY.</p>;
  }
  const added = points.reduce((n, p) => n + p.added, 0);
  const removed = points.reduce((n, p) => n + p.removed, 0);
  const current = points[points.length - 1].open;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Region">
          <span className={label}>REGION</span>
          {regions.map((r) => (
            <button key={r.key} type="button" aria-pressed={region === r.key} onClick={() => setRegion(r.key)} className={pill(region === r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart">
          <span className={label}>SHOW</span>
          <button type="button" aria-pressed={view === "net"} onClick={() => setView("net")} className={pill(view === "net")}>
            DAILY NET
          </button>
          <button type="button" aria-pressed={view === "open"} onClick={() => setView("open")} className={pill(view === "open")}>
            OPEN ROLES
          </button>
        </div>
      </div>

      <p className="font-mono text-[11px] tracking-[0.06em] text-dim" role="status">
        {fmt(current)} OPEN NOW · {signed(added)} ADDED · {signed(-removed)} REMOVED · NET {signed(added - removed)} OVER {points.length} DAYS
      </p>

      {view === "net" ? <NetChart points={points} /> : <OpenChart points={points} />}

      {view === "net" ? (
        <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] tracking-[0.1em]">
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-sm bg-accent" aria-hidden="true" />
            MORE ADDED THAN REMOVED
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-sm bg-fg opacity-45" aria-hidden="true" />
            MORE REMOVED THAN ADDED
          </span>
        </p>
      ) : null}
    </div>
  );
}

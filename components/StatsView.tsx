import Link from "next/link";
import { countryName } from "@/lib/geo";
import type { Bar, DayPoint, Range, Stats } from "@/lib/stats";
import { RANGES } from "@/lib/stats";

const label = "font-mono text-[10px] tracking-[0.1em] text-dim";
const fmt = (n: number) => n.toLocaleString("en");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : "0");

function Card({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass flex min-w-0 flex-col gap-4 rounded-[22px] p-5 ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-mono text-xs font-bold tracking-[0.12em]">[ {title} ]</h2>
        {note ? <p className={label}>{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Kpi({ name, value, sub, tone }: { name: string; value: string; sub: string; tone?: "up" | "down" }) {
  return (
    <div className="glass flex flex-col gap-2 rounded-[22px] p-5">
      <p className={label}>{name}</p>
      <p className={`font-display text-5xl font-extrabold leading-none ${tone === "down" ? "opacity-80" : ""}`}>{value}</p>
      <p className="font-mono text-[11px] tracking-[0.06em] text-dim">{sub}</p>
    </div>
  );
}

function BarList({ items, format }: { items: Bar[]; format?: (b: Bar) => string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 font-mono text-[11px] tracking-[0.06em]">
          <span className="truncate">{format ? format(i) : i.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-faint" aria-hidden="true">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (i.n / max) * 100)}%` }} />
          </span>
          <span className="tabular-nums text-dim">{fmt(i.n)}</span>
        </li>
      ))}
    </ul>
  );
}

const W = 720;
const H = 200;
const PAD = { l: 44, r: 12, t: 12, b: 24 };

function Timeline({ points }: { points: DayPoint[] }) {
  if (points.length < 2) {
    return <p className="font-mono text-xs leading-7 tracking-[0.06em] text-dim">HISTORY STARTS WITH THE FIRST SCRAPE. THE CHART FILLS IN DAY BY DAY.</p>;
  }
  const max = Math.max(...points.map((p) => p.open));
  const min = Math.min(...points.map((p) => p.eu));
  const lo = Math.max(0, Math.floor((min * 0.9) / 100) * 100);
  const hi = Math.max(lo + 1, Math.ceil(max / 100) * 100);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = (pick: (p: DayPoint) => number) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(pick(p)).toFixed(1)}`).join("");
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase();

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Open roles per day, global and European Union">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" className="font-mono" fill="var(--dim)">
              {fmt(t)}
            </text>
          </g>
        ))}
        <path d={line((p) => p.open)} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" />
        <path d={line((p) => p.eu)} fill="none" stroke="var(--map)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={x(i)} cy={y(p.open)} r="3" fill="var(--fg)" />
            <circle cx={x(i)} cy={y(p.eu)} r="3" fill="var(--map)" />
            {i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0 ? (
              <text x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" className="font-mono" fill="var(--dim)">
                {dayLabel(p.day)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] tracking-[0.1em]">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 bg-fg" aria-hidden="true" />
          GLOBAL
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5" style={{ background: "var(--map)" }} aria-hidden="true" />
          EUROPEAN UNION
        </span>
      </p>
    </div>
  );
}

export function StatsView({ stats, range }: { stats: Stats; range: Range }) {
  const { overview: o } = stats;
  const net = o.added - o.removed;
  const window = `LAST ${range} DAYS`;
  const activity = stats.timeline.reduce((n, p) => n + p.added + p.removed, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
        <span className={label}>RANGE</span>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === 7 ? "/statistics" : `/statistics?range=${r}`}
            aria-current={range === r ? "true" : undefined}
            className={`rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em] ${range === r ? "border-fg bg-faint font-bold" : "border-line"}`}
          >
            {r} DAYS
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi name="OPEN ROLES" value={fmt(o.open)} sub={`${o.companies} COMPANIES TRACKED`} />
        <Kpi name="IN EUROPE" value={fmt(o.europe)} sub={`${fmt(o.eu)} IN THE EU`} />
        <Kpi name={`ADDED · ${window}`} value={signed(o.added)} sub={`NET ${signed(net)}`} />
        <Kpi name={`REMOVED · ${window}`} value={signed(-o.removed)} sub={o.lastScrape ? "SINCE THE FIRST SCRAPE OF EACH COMPANY" : "NO SCRAPE YET"} tone="down" />
      </div>

      <Card title="OPEN ROLES OVER TIME" note={activity === 0 ? "NO CHANGES RECORDED YET" : "DAILY, END OF DAY"}>
        <Timeline points={stats.timeline} />
      </Card>

      <Card title="COMPANY LEADERBOARD" note={window}>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-mono text-[11px] tracking-[0.06em]">
            <thead>
              <tr className="text-left text-dim">
                <th scope="col" className="pb-2 pr-3 font-normal">#</th>
                <th scope="col" className="pb-2 pr-3 font-normal">COMPANY</th>
                <th scope="col" className="pb-2 pr-3 text-right font-normal">OPEN</th>
                <th scope="col" className="pb-2 pr-3 text-right font-normal">EUROPE</th>
                <th scope="col" className="pb-2 pr-3 text-right font-normal">ADDED</th>
                <th scope="col" className="pb-2 pr-3 text-right font-normal">REMOVED</th>
                <th scope="col" className="pb-2 text-right font-normal">NET</th>
              </tr>
            </thead>
            <tbody>
              {stats.companies.map((c, i) => (
                <tr key={c.slug} className="border-t border-line">
                  <td className="py-2.5 pr-3 text-dim">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-2.5 pr-3">
                    <Link href={`/?co=${c.slug}&scope=all`} className="font-bold underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(c.open)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmt(c.europe)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{signed(c.added)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{signed(-c.removed)}</td>
                  <td className="py-2.5 text-right font-bold tabular-nums">{signed(c.added - c.removed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="TOP COUNTRIES" note="OPEN ROLES">
          <BarList items={stats.countries} format={(b) => `${b.key} · ${countryName(b.key)}`} />
        </Card>
        <Card title="EXPERIENCE" note="READ FROM LISTING TEXT">
          <BarList items={stats.experience} />
        </Card>
        <Card title="CLASSIFICATIONS" note="OPEN ROLES">
          <BarList items={stats.classifications} />
        </Card>
      </div>
    </>
  );
}

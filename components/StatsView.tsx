import Link from "next/link";
import { countryName } from "@/lib/geo";
import { Timeline } from "@/components/Timeline";
import type { Bar, Range, Stats } from "@/lib/stats";
import { RANGES, REGIONS } from "@/lib/stats";

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

export function StatsView({ stats, range }: { stats: Stats; range: Range }) {
  const { overview: o } = stats;
  const net = o.added - o.removed;
  const window = `LAST ${range} DAYS`;
  const activity = stats.timeline.global.reduce((n, p) => n + p.added + p.removed, 0);

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
        <Kpi name={`REMOVED · ${window}`} value={signed(-o.removed)} sub={o.lastScrape ? "SINCE THE FIRST REFRESH OF EACH COMPANY" : "NO REFRESH YET"} tone="down" />
      </div>

      <Card title="ROLES OVER TIME" note={activity === 0 ? "NO CHANGES RECORDED YET" : "DAILY, END OF DAY"}>
        <Timeline regions={REGIONS.map(({ key, label }) => ({ key, label }))} timeline={stats.timeline} />
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
    </>
  );
}

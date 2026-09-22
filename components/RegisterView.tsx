import Link from "next/link";
import { countryName } from "@/lib/geo";
import type { Register } from "@/lib/stats";
import { ArrowUpRightIcon } from "./icons";

const label = "font-mono text-[10px] tracking-[0.1em] text-dim";
const fmt = (n: number) => n.toLocaleString("en");
const sourceLabel = (source: string) => (source === "custom" ? "CUSTOM SITEMAP" : source.toUpperCase());

type Props = { companies: Register[]; sectors: string[]; sector: string | null };

export function RegisterView({ companies, sectors, sector }: Props) {
  const shown = sector ? companies.filter((c) => c.sector === sector) : companies;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sector">
        <span className={label}>SECTOR</span>
        {[null, ...sectors].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/companies?sector=${encodeURIComponent(s)}` : "/companies"}
            aria-current={sector === s ? "true" : undefined}
            className={`rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em] ${sector === s ? "border-fg bg-faint font-bold" : "border-line"}`}
          >
            {s ? s.toUpperCase() : "ALL"}
          </Link>
        ))}
        <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-dim">
          {shown.length} {shown.length === 1 ? "COMPANY" : "COMPANIES"}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <li key={c.slug} className="glass flex min-w-0 flex-col gap-5 rounded-[22px] p-5">
            <div className="flex items-start gap-3.5">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-faint font-mono text-lg font-bold">
                {c.name.charAt(0)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="truncate text-xl font-bold leading-tight">{c.name}</h2>
                <p className="truncate font-mono text-[11px] tracking-[0.06em] text-dim">
                  {c.sector ? c.sector.toUpperCase() : "—"}
                  {c.hq ? ` · HQ ${countryName(c.hq).toUpperCase()}` : ""}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div className="flex flex-col gap-0.5">
                <dt className={label}>OPEN</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{fmt(c.open)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className={label}>EUROPE</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{fmt(c.europe)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className={label}>EU</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{fmt(c.eu)}</dd>
              </div>
            </dl>

            <p className="font-mono text-[10px] tracking-[0.08em] text-dim">
              SOURCE: {sourceLabel(c.source)} · {c.checked ? `CHECKED ${c.checked.toUpperCase()}` : "NOT CHECKED YET"}
            </p>

            <div className="mt-auto flex gap-2.5">
              <Link
                href={`/?co=${c.slug}&scope=all`}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent font-mono text-[12px] font-bold tracking-[0.08em] text-on-accent"
              >
                VIEW ROLES
              </Link>
              {c.careersUrl ? (
                <a
                  href={c.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-fg font-mono text-[12px] font-bold tracking-[0.08em]"
                >
                  CAREERS PAGE
                  <ArrowUpRightIcon />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

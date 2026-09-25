import Link from "next/link";
import { classificationLabel } from "@/lib/classifications";
import { countryName } from "@/lib/geo";
import type { Register } from "@/lib/stats";
import { CompanyLogo } from "./CompanyLogo";
import { ArrowUpRightIcon } from "./icons";

const label = "font-mono text-[10px] tracking-[0.1em] text-dim";
const fmt = (n: number) => n.toLocaleString("en");
const figure = (c: Register, n: number) => (c.scraped ? fmt(n) : "—");
const sourceLabel = (source: string) => (source === "custom" ? "OWN CAREERS SITE" : source.toUpperCase());

type Props = { companies: Register[]; classifications: string[]; classification: string | null };

export function RegisterView({ companies, classifications, classification }: Props) {
  const shown = classification ? companies.filter((c) => c.classification === classification) : companies;
  const live = shown.filter((c) => c.scraped).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Classification">
        <span className={label}>CLASSIFICATION</span>
        {[null, ...classifications].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/companies?classification=${encodeURIComponent(s)}` : "/companies"}
            aria-current={classification === s ? "true" : undefined}
            className={`rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em] ${classification === s ? "border-fg bg-faint font-bold" : "border-line"}`}
          >
            {s ? classificationLabel(s) : "ALL"}
          </Link>
        ))}
        <span className="ml-auto font-mono text-[11px] tracking-[0.08em] text-dim">
          {shown.length} {shown.length === 1 ? "COMPANY" : "COMPANIES"}
          {live < shown.length ? ` · ${live} LIVE` : ""}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <li key={c.slug} className="glass flex min-w-0 flex-col gap-5 rounded-[22px] p-5">
            {c.scraped ? null : (
              <p className="-mb-2 self-end rounded border border-line px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-dim">[ SCRAPE NOT AVAILABLE ]</p>
            )}
            <div className="flex items-start gap-3.5">
              <CompanyLogo name={c.name} logo={c.logo} className="size-12 text-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="truncate text-xl font-bold leading-tight">{c.name}</h2>
                <p className="truncate font-mono text-[11px] tracking-[0.06em] text-dim">
                  {c.classification ? classificationLabel(c.classification) : "—"}
                  {c.hq ? ` · HQ ${countryName(c.hq).toUpperCase()}` : ""}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div className="flex flex-col gap-0.5">
                <dt className={label}>OPEN</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{figure(c, c.open)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className={label}>EUROPE</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{figure(c, c.europe)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className={label}>EU</dt>
                <dd className="font-display text-3xl font-extrabold leading-none">{figure(c, c.eu)}</dd>
              </div>
            </dl>

            <p className="font-mono text-[10px] tracking-[0.08em] text-dim">
              {c.scraped ? `SOURCE: ${sourceLabel(c.source)} · ${c.checked ? `CHECKED ${c.checked.toUpperCase()}` : "NOT CHECKED YET"}` : "NO AUTOMATIC SCRAPE · OPEN ROLES ON THE COMPANY'S OWN PAGE"}
            </p>

            <div className="mt-auto flex gap-2.5">
              {c.scraped ? (
                <Link
                  href={`/?co=${c.slug}&scope=all`}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent font-mono text-[12px] font-bold tracking-[0.08em] text-on-accent"
                >
                  VIEW ROLES
                </Link>
              ) : null}
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

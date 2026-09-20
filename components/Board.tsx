"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { countryName, type Scope } from "@/lib/geo";
import type { Filters, JobView } from "@/lib/jobs";
import { ChevronIcon, CloseIcon, GlobeIcon } from "./icons";
import { JobList } from "./JobList";
import { MapPanel } from "./MapPanel";
import { SearchBar } from "./SearchBar";
import { Preview } from "./Preview";
import { useFilterNav } from "./useFilterNav";

type Props = {
  jobs: JobView[];
  total: number;
  limit: number;
  filters: Filters;
  facets: Record<string, number>;
  globalFacets: Record<string, number>;
  sectors: string[];
  headline: { roles: number; companies: number; updated: string | null };
};

const chip = "rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em]";

const SCOPE_LABEL: Record<Scope, string> = { europe: "EUROPE", eu: "EU ONLY", outside: "OUTSIDE EUROPE", all: "GLOBAL" };

export function Board({ jobs, total, limit, filters, facets, globalFacets, sectors, headline }: Props) {
  const { update, pending } = useFilterNav();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;
  const outside = filters.scope === "outside" && filters.countries.length === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setMapOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function setCountries(next: string[]) {
    update({ c: next.length ? next.join(",") : null });
  }

  function toggleCountry(iso: string) {
    const has = filters.countries.includes(iso);
    if (multi) setCountries(has ? filters.countries.filter((c) => c !== iso) : [...filters.countries, iso]);
    else setCountries(has && filters.countries.length === 1 ? [] : [iso]);
  }

  const advancedList = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    return Object.entries(globalFacets)
      .map(([code, n]) => ({ code, n, name: countryName(code) }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [globalFacets, countryQuery]);

  const shown = filters.countries.length > 0 ? filters.countries.join(", ") : SCOPE_LABEL[filters.scope];

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 lg:px-12 lg:pt-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
        <section aria-label="Open roles" className={`flex min-w-0 flex-col gap-5 ${selectedJob ? "max-lg:pb-44" : ""}`}>
          <div className="flex flex-col gap-3.5">
            <p className="font-mono text-xs tracking-[0.12em] text-dim max-lg:pr-14">
              [{headline.roles.toLocaleString("en")}] OPEN ROLES · [{headline.companies}] COMPANIES
              {headline.updated ? ` · UPDATED ${headline.updated.toUpperCase()}` : ""}
            </p>
            <h1 className="font-display text-[clamp(44px,9vw,84px)] font-extrabold uppercase leading-[0.92] tracking-[0.01em]">
              Find open roles.
              <br />
              Defence &amp; space.
            </h1>
          </div>

          <SearchBar query={filters.q} />

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-2 lg:hidden" role="group" aria-label="Region scope">
              {(["europe", "eu", "outside", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.scope === value}
                  onClick={() => update({ scope: value === "europe" ? null : value, c: null })}
                  className={`${chip} ${filters.scope === value ? "border-fg bg-faint" : "border-line"}`}
                >
                  {SCOPE_LABEL[value]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="View">
              {[
                { id: "all", label: "ALL" },
                { id: "new", label: "NEW · 24H" },
              ].map((t) => {
                const on = (t.id === "new") === filters.newOnly;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ tab: t.id === "new" ? "new" : null })}
                    className={`rounded-[10px] border px-4 py-2.5 font-mono text-xs tracking-[0.08em] ${on ? "border-accent bg-accent font-bold text-on-accent" : "border-line"}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={!filters.sector}
                onClick={() => update({ sector: null })}
                className={`${chip} ${!filters.sector ? "border-fg bg-faint" : "border-line"}`}
              >
                ALL SECTORS
              </button>
              {sectors.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={filters.sector === s}
                  onClick={() => update({ sector: filters.sector === s ? null : s })}
                  className={`${chip} ${filters.sector === s ? "border-fg bg-faint" : "border-line"}`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={filters.remote}
                onClick={() => update({ remote: filters.remote ? null : "1" })}
                className={`${chip} ${filters.remote ? "border-fg bg-faint" : "border-line"}`}
              >
                REMOTE
              </button>
              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((v) => !v)}
                className={`${chip} ml-auto flex items-center gap-1.5 border-line`}
              >
                ADVANCED
                <ChevronIcon className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {advancedOpen ? (
              <div className="glass flex flex-col gap-3 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <label className="flex flex-1 items-center gap-2 font-mono text-[11px] tracking-[0.08em]">
                    COUNTRY
                    <input
                      type="search"
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      placeholder="Search any country"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-faint px-3 py-2 font-mono text-xs outline-none placeholder:text-dim"
                    />
                  </label>
                  {filters.countries.length > 0 ? (
                    <button type="button" onClick={() => setCountries([])} className={`${chip} border-line`}>
                      CLEAR
                    </button>
                  ) : null}
                </div>
                <ul className="scroll-thin grid max-h-52 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
                  {advancedList.map((c) => {
                    const on = filters.countries.includes(c.code);
                    return (
                      <li key={c.code}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setCountries(on ? filters.countries.filter((x) => x !== c.code) : [...filters.countries, c.code])}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] ${on ? "border-fg bg-faint font-bold" : "border-line"}`}
                        >
                          <span className="truncate">
                            {c.code} · {c.name}
                          </span>
                          <span className="text-dim">{c.n}</span>
                        </button>
                      </li>
                    );
                  })}
                  {advancedList.length === 0 ? <li className="col-span-full font-mono text-[11px] text-dim">NO MATCHING COUNTRY</li> : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.08em] text-dim">
            <span>
              {total.toLocaleString("en")} {total === 1 ? "ROLE" : "ROLES"} · {shown}
            </span>
            <span>SORT: LATEST</span>
          </div>

          {jobs.length === 0 ? (
            <div className="glass rounded-2xl p-6 font-mono text-xs leading-7 tracking-[0.06em]">
              <p className="font-bold">NO ROLES MATCH THESE FILTERS.</p>
              <p className="text-dim">Widen the region, clear the country selection or search for something else.</p>
              <Link href="/" className="mt-3 inline-block underline underline-offset-4">
                RESET ALL FILTERS
              </Link>
            </div>
          ) : (
            <JobList jobs={jobs} selectedId={selectedJob?.id ?? null} pending={pending} onSelect={setSelectedId} />
          )}

          {jobs.length < total ? (
            <button
              type="button"
              onClick={() => update({ limit: String(limit + 50) })}
              className="mx-auto rounded-[10px] border border-line px-5 py-2.5 font-mono text-xs tracking-[0.1em]"
            >
              LOAD MORE · {jobs.length.toLocaleString("en")} / {total.toLocaleString("en")}
            </button>
          ) : null}
        </section>

        <aside className="scroll-thin contents lg:sticky lg:top-[72px] lg:-mx-10 lg:flex lg:max-h-[calc(100dvh-72px)] lg:flex-col lg:gap-5 lg:self-start lg:overflow-y-auto lg:px-10 lg:py-6">
          <MapPanel
            open={mapOpen}
            scope={filters.scope}
            counts={facets}
            selected={filters.countries}
            highlighted={selectedJob?.countries ?? []}
            multi={multi}
            outside={outside}
            onMulti={setMulti}
            onToggle={toggleCountry}
            onClear={() => update({ c: null, scope: filters.scope === "outside" ? null : filters.scope })}
            onOutside={() => update({ scope: outside ? null : "outside", c: null })}
          />
          <Preview job={selectedJob} onClose={() => setSelectedId(null)} />
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMapOpen((v) => !v)}
        aria-expanded={mapOpen}
        aria-label={mapOpen ? "Close map filter" : "Open map filter"}
        className="glass fixed right-3 top-[68px] z-50 grid size-12 place-items-center rounded-full md:top-[84px] lg:hidden"
      >
        {mapOpen ? <CloseIcon size={18} /> : <GlobeIcon size={22} />}
        {filters.countries.length > 0 && !mapOpen ? (
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent font-mono text-[10px] font-bold text-on-accent">
            {filters.countries.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EXPERIENCE_BUCKETS } from "@/lib/experience";
import { countryName, type Scope } from "@/lib/geo";
import type { CompanyFacet, Filters, JobView } from "@/lib/jobs";
import { AdvancedFilters } from "./AdvancedFilters";
import { ChevronIcon, CloseIcon, GlobeIcon } from "./icons";
import { JobList } from "./JobList";
import { MapPanel } from "./MapPanel";
import { Preview } from "./Preview";
import { ResultsBar } from "./ResultsBar";
import { SearchBar } from "./SearchBar";
import { useFilterNav } from "./useFilterNav";

type Props = {
  jobs: JobView[];
  total: number;
  limit: number;
  filters: Filters;
  facets: Record<string, number>;
  globalFacets: Record<string, number>;
  companyFacets: CompanyFacet[];
  sectors: string[];
  headline: { roles: number; companies: number; updated: string | null };
};

const chip = "rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em]";

const SCOPE_LABEL: Record<Scope, string> = { europe: "EUROPE", eu: "EU ONLY", all: "GLOBAL" };

const ADVANCED_RESET = { c: null, co: null, sector: null, exp: null };

export function Board({ jobs, total, limit, filters, facets, globalFacets, companyFacets, sectors, headline }: Props) {
  const { update, pending } = useFilterNav();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

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

  const companyName = (slug: string) => companyFacets.find((c) => c.slug === slug)?.name ?? slug;

  const active: { key: string; label: string; clear: () => void }[] = [
    ...filters.countries.map((c) => ({ key: `c-${c}`, label: countryName(c), clear: () => setCountries(filters.countries.filter((x) => x !== c)) })),
    ...filters.companies.map((slug) => ({
      key: `co-${slug}`,
      label: companyName(slug),
      clear: () => {
        const next = filters.companies.filter((x) => x !== slug);
        update({ co: next.length ? next.join(",") : null });
      },
    })),
    ...(filters.sector ? [{ key: "sector", label: filters.sector.toUpperCase(), clear: () => update({ sector: null }) }] : []),
    ...(filters.experience ? [{ key: "exp", label: EXPERIENCE_BUCKETS[filters.experience].label, clear: () => update({ exp: null }) }] : []),
  ];

  const advancedCount = filters.countries.length + filters.companies.length + (filters.sector ? 1 : 0) + (filters.experience ? 1 : 0);
  const summary = filters.countries.length > 0 ? filters.countries.join(", ") : SCOPE_LABEL[filters.scope];
  const step = limit <= 20 ? 20 : 50;

  return (
    <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 md:px-12 md:pt-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_470px]">
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

          <SearchBar key={searchKey} query={filters.q} />

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-2 lg:hidden" role="group" aria-label="Region scope">
              {(["europe", "eu", "all"] as const).map((value) => (
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

            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                aria-pressed={filters.remote}
                onClick={() => update({ remote: filters.remote ? null : "1" })}
                className={`${chip} py-2.5 ${filters.remote ? "border-fg bg-faint" : "border-line"}`}
              >
                REMOTE
              </button>
              <div className="ml-auto flex items-center gap-2">
                {advancedCount > 0 ? (
                  <button type="button" onClick={() => update(ADVANCED_RESET)} className={`${chip} py-2.5 underline underline-offset-4`}>
                    RESET ALL FILTERS
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className={`${chip} flex items-center gap-2 py-2.5 ${advancedCount ? "border-fg" : "border-line"}`}
                >
                  ADVANCED
                  {advancedCount ? <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-on-accent">{advancedCount}</span> : null}
                  <ChevronIcon className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {advancedOpen ? (
              <AdvancedFilters
                countries={filters.countries}
                countryFacets={globalFacets}
                companies={filters.companies}
                companyFacets={companyFacets}
                sector={filters.sector}
                sectors={sectors}
                experience={filters.experience}
                onChange={update}
              />
            ) : null}

            {active.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                {active.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      onClick={a.clear}
                      aria-label={`Remove filter ${a.label}`}
                      className="flex items-center gap-1.5 rounded-full border border-fg bg-faint py-1 pl-3 pr-2 font-mono text-[11px] tracking-[0.06em]"
                    >
                      {a.label}
                      <CloseIcon size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ResultsBar
            total={total}
            summary={summary}
            sort={filters.sort}
            limit={limit}
            onSort={(sort) => update({ sort: sort === "latest" ? null : sort })}
            onLimit={(n) => update({ limit: n === 20 ? null : String(n) })}
          />

          {jobs.length === 0 ? (
            <div className="glass rounded-2xl p-6 font-mono text-xs leading-7 tracking-[0.06em]">
              <p className="font-bold">NO ROLES MATCH THESE FILTERS.</p>
              <p className="text-dim">Widen the region, clear the country selection or search for something else.</p>
              <button
                type="button"
                onClick={() => {
                  update({ ...ADVANCED_RESET, q: null, remote: null, tab: null });
                  setSearchKey((k) => k + 1);
                }}
                className="mt-3 inline-block underline underline-offset-4"
              >
                RESET ALL FILTERS
              </button>
            </div>
          ) : (
            <JobList jobs={jobs} selectedId={selectedJob?.id ?? null} pending={pending} onSelect={setSelectedId} />
          )}

          {jobs.length < total ? (
            <button
              type="button"
              onClick={() => update({ limit: String(limit + step) })}
              className="mx-auto rounded-[10px] border border-line px-5 py-2.5 font-mono text-xs tracking-[0.1em]"
            >
              LOAD MORE · {jobs.length.toLocaleString("en")} / {total.toLocaleString("en")}
            </button>
          ) : null}
        </section>

        <aside className="scroll-thin contents lg:sticky lg:top-[72px] lg:-mx-10 lg:flex lg:flex-col lg:gap-4 lg:self-start lg:px-10 lg:py-5 [@media(max-height:760px)]:lg:max-h-[calc(100dvh-72px)] [@media(max-height:760px)]:lg:overflow-y-auto">
          <MapPanel
            open={mapOpen}
            scope={filters.scope}
            counts={facets}
            selected={filters.countries}
            highlighted={selectedJob?.countries ?? []}
            multi={multi}
            onMulti={setMulti}
            onToggle={toggleCountry}
            onClear={() => update({ c: null })}
            onScope={(scope) => update({ scope: scope === "europe" ? null : scope, c: null })}
          />
          <Preview job={selectedJob} onClose={() => setSelectedId(null)} />
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMapOpen((v) => !v)}
        aria-expanded={mapOpen}
        aria-label={mapOpen ? "Close map filter" : "Open map filter"}
        className="glass fixed right-3 top-[108px] z-50 grid size-12 place-items-center rounded-full md:top-[84px] lg:hidden"
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

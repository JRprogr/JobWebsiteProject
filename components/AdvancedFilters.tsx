"use client";

import { useMemo, useState } from "react";
import { EXPERIENCE_BUCKETS, type ExperienceBucket } from "@/lib/experience";
import { countryName } from "@/lib/geo";
import type { CompanyFacet } from "@/lib/jobs";
import { ChevronIcon } from "./icons";

type Section = "country" | "company" | "sector" | "experience";

type Props = {
  countries: string[];
  countryFacets: Record<string, number>;
  companies: string[];
  companyFacets: CompanyFacet[];
  sector: string | null;
  sectors: string[];
  experience: ExperienceBucket | null;
  onChange: (patch: Record<string, string | null>) => void;
};

const chip = "rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em]";

type Item = { key: string; label: string; n: number };

function PickList({ items, selected, placeholder, onToggle }: { items: Item[]; selected: string[]; placeholder: string; onToggle: (key: string) => void }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase() === q) : items;
  }, [items, query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="rounded-lg border border-line bg-faint px-3 py-2 font-mono text-xs outline-none placeholder:text-dim"
      />
      <ul className="scroll-thin grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item) => {
          const on = selected.includes(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(item.key)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] ${on ? "border-fg bg-faint font-bold" : "border-line"}`}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-dim">{item.n}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 ? <li className="col-span-full font-mono text-[11px] text-dim">NOTHING MATCHES</li> : null}
      </ul>
    </div>
  );
}

export function AdvancedFilters({ countries, countryFacets, companies, companyFacets, sector, sectors, experience, onChange }: Props) {
  const [open, setOpen] = useState<Section | null>(null);

  const countryItems = useMemo(
    () =>
      Object.entries(countryFacets)
        .map(([code, n]) => ({ key: code, label: `${code} · ${countryName(code)}`, n }))
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
    [countryFacets],
  );
  const companyItems = useMemo(() => companyFacets.map((c) => ({ key: c.slug, label: c.name, n: c.n })), [companyFacets]);

  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const sections: { id: Section; title: string; badge: string | null; body: React.ReactNode }[] = [
    {
      id: "country",
      title: "COUNTRY",
      badge: countries.length ? String(countries.length) : null,
      body: (
        <PickList
          items={countryItems}
          selected={countries}
          placeholder="Search any country"
          onToggle={(code) => {
            const next = toggle(countries, code);
            onChange({ c: next.length ? next.join(",") : null });
          }}
        />
      ),
    },
    {
      id: "company",
      title: "COMPANY",
      badge: companies.length ? String(companies.length) : null,
      body: (
        <PickList
          items={companyItems}
          selected={companies}
          placeholder="Search companies"
          onToggle={(slug) => {
            const next = toggle(companies, slug);
            onChange({ co: next.length ? next.join(",") : null });
          }}
        />
      ),
    },
    {
      id: "sector",
      title: "SECTOR",
      badge: sector ? sector.toUpperCase() : null,
      body: (
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!sector} onClick={() => onChange({ sector: null })} className={`${chip} ${!sector ? "border-fg bg-faint" : "border-line"}`}>
            ALL SECTORS
          </button>
          {sectors.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sector === s}
              onClick={() => onChange({ sector: sector === s ? null : s })}
              className={`${chip} ${sector === s ? "border-fg bg-faint" : "border-line"}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "experience",
      title: "EXPERIENCE",
      badge: experience ? EXPERIENCE_BUCKETS[experience].label.split(" · ")[0] : null,
      body: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!experience} onClick={() => onChange({ exp: null })} className={`${chip} ${!experience ? "border-fg bg-faint" : "border-line"}`}>
              ANY
            </button>
            {(Object.keys(EXPERIENCE_BUCKETS) as ExperienceBucket[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={experience === key}
                onClick={() => onChange({ exp: experience === key ? null : key })}
                className={`${chip} ${experience === key ? "border-fg bg-faint" : "border-line"}`}
              >
                {EXPERIENCE_BUCKETS[key].label}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] leading-5 tracking-[0.06em] text-dim">
            READ FROM THE LISTING TEXT. A ~ MARKS AN ESTIMATE (E.G. &ldquo;SEVERAL YEARS&rdquo; OR A SENIOR TITLE). ROLES WITHOUT A STATED LEVEL ARE HIDDEN WHILE THIS FILTER IS ON.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="glass flex flex-col divide-y divide-line overflow-hidden rounded-2xl">
      {sections.map((s) => {
        const expanded = open === s.id;
        return (
          <section key={s.id}>
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : s.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 font-mono text-[11px] tracking-[0.1em]"
              >
                <span className="flex items-center gap-2.5">
                  {s.title}
                  {s.badge ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">{s.badge}</span> : null}
                </span>
                <ChevronIcon className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            </h3>
            {expanded ? <div className="px-4 pb-4">{s.body}</div> : null}
          </section>
        );
      })}
    </div>
  );
}

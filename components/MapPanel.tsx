"use client";

import { useState } from "react";
import { countryName, SCOPES, type Scope } from "@/lib/geo";
import { EuMap } from "./EuMap";
import { CloseIcon, EuFlagIcon, GlobeIcon } from "./icons";

const SCOPE_ICON: Partial<Record<Scope, typeof GlobeIcon>> = { eu: EuFlagIcon, all: GlobeIcon };
// "EUR" read as the currency, so the buttons spell out what they are
const SCOPE_TEXT: Record<Scope, string> = { europe: "EUROPE", eu: "EU", all: "GLOBAL" };

type Props = {
  open: boolean;
  scope: Scope;
  counts: Record<string, number>;
  selected: string[];
  highlighted: string[];
  multi: boolean;
  onMulti: (value: boolean) => void;
  onToggle: (iso: string) => void;
  onClear: () => void;
  onScope: (scope: Scope) => void;
};

export function MapPanel({ open, scope, counts, selected, highlighted, multi, onMulti, onToggle, onClear, onScope }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedSet = new Set(selected);
  const highlightedSet = new Set(highlighted);

  const readout = hovered
    ? `${countryName(hovered).toUpperCase()} · ${counts[hovered] ?? 0} ${(counts[hovered] ?? 0) === 1 ? "ROLE" : "ROLES"}`
    : selected.length > 0
      ? `SEL: ${selected.join(" · ")}`
      : { europe: "EU + EFTA + UK + WEST BALKANS", eu: "EU ONLY", all: "GLOBAL" }[scope];

  return (
    <section
      data-open={open}
      aria-label="Region filter"
      className="glass flex flex-col gap-3 rounded-[22px] p-4 lg:p-5 max-lg:fixed max-lg:inset-x-3 max-lg:top-[104px] md:max-lg:top-20 max-lg:z-40 max-lg:max-h-[calc(100dvh-9.5rem)] md:max-lg:max-h-[calc(100dvh-8rem)] max-lg:overflow-y-auto max-lg:transition-[transform,visibility] max-lg:duration-300 max-lg:data-[open=false]:invisible max-lg:data-[open=false]:-translate-y-[120%]"
    >
      {/* The header's height must never depend on the readout text: it changes on every hover, and a header that wraps
          or grows under a long country name shifts the map away from the pointer, which then flickers in and out. */}
      <div className="-mt-1 grid grid-cols-1 gap-y-2 lg:grid-cols-[1fr_auto] lg:gap-x-3">
        <h2 className="whitespace-nowrap font-mono text-xs font-bold tracking-[0.12em] text-map max-lg:pr-14 lg:col-start-1 lg:row-start-1 lg:self-center">
          [ <span className="max-lg:hidden">TARGET </span>REGION ]
        </h2>
        <p className="flex h-5 min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-map lg:col-span-2 lg:row-start-2" aria-live="polite">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          <span className="truncate">{readout}</span>
        </p>

        <div className="flex items-center gap-1.5 lg:col-start-2 lg:row-start-1" role="group" aria-label="Region scope">
          {SCOPES.map((s) => {
            const Icon = SCOPE_ICON[s.value];
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onScope(s.value)}
                aria-pressed={scope === s.value}
                title={s.label}
                className={`flex h-10 items-center gap-1.5 rounded-[9px] border border-current px-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-map ${scope === s.value ? "bg-faint" : "opacity-70"}`}
              >
                {Icon ? <Icon size={18} /> : null}
                {SCOPE_TEXT[s.value]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-frame relative overflow-hidden rounded-[14px] border border-line" style={{ background: "var(--map-panel)" }}>
        <EuMap scope={scope} counts={counts} selected={selectedSet} highlighted={highlightedSet} hovered={hovered} onHover={setHovered} onToggle={onToggle} />
        <div className="scanlines absolute inset-0" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-xs tracking-[0.06em]">
        <button type="button" role="switch" aria-checked={multi} onClick={() => onMulti(!multi)} className="flex items-center gap-2.5">
          <span
            className="relative block h-[22px] w-10 rounded-full border bg-faint transition-[border-color,box-shadow] duration-200"
            style={multi ? { borderColor: "var(--map)", boxShadow: "0 0 8px var(--map), inset 0 0 6px var(--map-grat)" } : { borderColor: "var(--line)" }}
          >
            <span
              className={`absolute top-[3px] size-3.5 rounded-full transition-all duration-200 ${multi ? "left-[calc(100%-17px)]" : "left-[3px] bg-fg"}`}
              style={multi ? { background: "var(--map)", boxShadow: "0 0 6px var(--map)" } : undefined}
            />
          </span>
          SELECT MULTIPLE
        </button>
        <button type="button" onClick={onClear} disabled={selected.length === 0} className="flex items-center gap-2 disabled:opacity-40">
          <span className="grid size-[22px] place-items-center rounded-full bg-accent text-on-accent">
            <CloseIcon size={11} />
          </span>
          DE-SELECT ALL
        </button>
      </div>
    </section>
  );
}

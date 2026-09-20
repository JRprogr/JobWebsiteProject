"use client";

import { useState } from "react";
import { countryName, type Scope } from "@/lib/geo";
import { EuMap } from "./EuMap";
import { CloseIcon, GlobeIcon } from "./icons";

type Props = {
  open: boolean;
  scope: Scope;
  counts: Record<string, number>;
  selected: string[];
  highlighted: string[];
  multi: boolean;
  outside: boolean;
  onMulti: (value: boolean) => void;
  onToggle: (iso: string) => void;
  onClear: () => void;
  onOutside: () => void;
};

export function MapPanel({ open, scope, counts, selected, highlighted, multi, outside, onMulti, onToggle, onClear, onOutside }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedSet = new Set(selected);
  const highlightedSet = new Set(highlighted);

  const readout = hovered
    ? `${countryName(hovered).toUpperCase()} · ${counts[hovered] ?? 0} ${(counts[hovered] ?? 0) === 1 ? "ROLE" : "ROLES"}`
    : selected.length > 0
      ? `SEL: ${selected.join(" · ")}`
      : { europe: "ALL OF EUROPE", eu: "EU ONLY", outside: "OUTSIDE EUROPE", all: "GLOBAL" }[scope];

  return (
    <section
      data-open={open}
      aria-label="Region filter"
      className="glass flex flex-col gap-3 rounded-[22px] p-4 lg:p-5 max-lg:fixed max-lg:inset-x-3 max-lg:top-16 md:max-lg:top-20 max-lg:z-40 max-lg:max-h-[calc(100dvh-8rem)] max-lg:overflow-y-auto max-lg:transition-[transform,visibility] max-lg:duration-300 max-lg:data-[open=false]:invisible max-lg:data-[open=false]:-translate-y-[120%]"
    >
      <div className="-mt-1 flex items-center justify-between gap-3 max-lg:pr-14">
        <h2 className="whitespace-nowrap font-mono text-xs font-bold tracking-[0.12em] text-map">[ <span className="max-lg:hidden">TARGET </span>REGION ]</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOutside}
            aria-pressed={outside}
            className={`flex items-center gap-2 whitespace-nowrap rounded-[9px] border border-current px-2.5 py-1.5 font-mono text-[11px] tracking-[0.08em] text-map ${outside ? "bg-faint" : ""}`}
          >
            <GlobeIcon size={16} />
            OUTSIDE EUROPE
          </button>
        </div>
      </div>

      <p className="flex min-h-5 items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-map" aria-live="polite">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {readout}
      </p>

      <div className="relative overflow-hidden rounded-[14px] border border-line" style={{ background: "var(--map-panel)" }}>
        <EuMap scope={scope} counts={counts} selected={selectedSet} highlighted={highlightedSet} hovered={hovered} onHover={setHovered} onToggle={onToggle} />
        <div className="scanlines absolute inset-0" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-xs tracking-[0.06em]">
        <button type="button" role="switch" aria-checked={multi} onClick={() => onMulti(!multi)} className="flex items-center gap-2.5">
          <span className="relative block h-[22px] w-10 rounded-full border border-line bg-faint">
            <span className={`absolute top-[3px] size-3.5 rounded-full bg-fg transition-all duration-200 ${multi ? "left-[calc(100%-17px)]" : "left-[3px]"}`} />
          </span>
          SELECT MULTIPLE
        </button>
        <button type="button" onClick={onClear} disabled={selected.length === 0 && !outside} className="flex items-center gap-2 disabled:opacity-40">
          <span className="grid size-[22px] place-items-center rounded-full bg-accent text-on-accent">
            <CloseIcon size={11} />
          </span>
          DE-SELECT ALL
        </button>
      </div>
    </section>
  );
}

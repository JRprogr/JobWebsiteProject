"use client";

import { useState } from "react";
import { countryName } from "@/lib/geo";
import { EuMap } from "./EuMap";
import { CloseIcon, GlobeIcon } from "./icons";

type Props = {
  open: boolean;
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

export function MapPanel({ open, counts, selected, highlighted, multi, outside, onMulti, onToggle, onClear, onOutside }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedSet = new Set(selected);
  const highlightedSet = new Set(highlighted);

  const readout = hovered
    ? `${countryName(hovered).toUpperCase()} · ${counts[hovered] ?? 0} ${(counts[hovered] ?? 0) === 1 ? "ROLE" : "ROLES"}`
    : selected.length > 0
      ? `SEL: ${selected.join(" · ")}`
      : outside
        ? "OUTSIDE EUROPE"
        : "ALL OF EUROPE";

  return (
    <section
      data-open={open}
      aria-label="Region filter"
      className="glass flex flex-col gap-3 rounded-[22px] p-4 md:p-5 max-md:fixed max-md:inset-x-3 max-md:top-16 max-md:z-40 max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto max-md:transition-[transform,visibility] max-md:duration-300 max-md:data-[open=false]:invisible max-md:data-[open=false]:-translate-y-[120%]"
    >
      <div className="flex items-center justify-between gap-3 max-md:pr-14">
        <h2 className="whitespace-nowrap font-mono text-xs font-bold tracking-[0.12em] text-map">[ <span className="max-md:hidden">TARGET </span>REGION ]</h2>
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

      <div className="relative overflow-hidden rounded-[14px] border border-line" style={{ background: "var(--map-panel)" }}>
        <EuMap counts={counts} selected={selectedSet} highlighted={highlightedSet} hovered={hovered} onHover={setHovered} onToggle={onToggle} />
        <div className="scanlines absolute inset-0" aria-hidden="true" />
        <p className="pointer-events-none absolute left-3 top-2.5 font-mono text-[10px] tracking-[0.1em] text-map" aria-live="polite">
          {readout}
        </p>
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

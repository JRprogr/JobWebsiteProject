"use client";

import mapJson from "@/lib/geo/europe-map.json";
import { countryName } from "@/lib/geo";

type MapCountry = {
  iso: string;
  tier: "eu" | "europe" | "near";
  name: string;
  dots: string;
  hit: string;
  area: number;
  label: [number, number] | null;
};

const map = mapJson as unknown as { w: number; h: number; graticule: string; countries: MapCountry[] };

type Props = {
  counts: Record<string, number>;
  selected: ReadonlySet<string>;
  highlighted: ReadonlySet<string>;
  hovered: string | null;
  onHover: (iso: string | null) => void;
  onToggle: (iso: string) => void;
};

export function EuMap({ counts, selected, highlighted, hovered, onHover, onToggle }: Props) {
  return (
    <svg viewBox={`0 0 ${map.w} ${map.h}`} className="mx-auto block h-auto max-h-[38dvh] w-full" role="group" aria-label="Map of Europe. Select countries to filter roles.">
      <path d={map.graticule} fill="none" stroke="var(--map-grat)" strokeWidth={0.7} />
      {map.countries.map((c) => {
        const count = counts[c.iso] ?? 0;
        const active = selected.has(c.iso) || highlighted.has(c.iso);
        const fallbackDot = !c.dots && c.label ? `M${c.label[0]} ${c.label[1]}h0` : "";
        return (
          <g key={c.iso} className="map-country" data-tier={c.tier} data-empty={count === 0} data-active={active} data-hover={hovered === c.iso}>
            <path className="map-dots" d={c.dots || fallbackDot} />
            <path
              className="map-hit"
              d={c.hit}
              role="button"
              tabIndex={0}
              aria-pressed={selected.has(c.iso)}
              aria-label={`${countryName(c.iso)}, ${count} ${count === 1 ? "role" : "roles"}`}
              onClick={() => onToggle(c.iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(c.iso);
                }
              }}
              onPointerEnter={() => onHover(c.iso)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(c.iso)}
              onBlur={() => onHover(null)}
            />
          </g>
        );
      })}
      {map.countries
        .filter((c) => c.tier !== "near" && c.area > 380 && c.label)
        .map((c) => (
          <text
            key={c.iso}
            x={c.label![0]}
            y={c.label![1] + 3}
            textAnchor="middle"
            fill="var(--map-label)"
            opacity={selected.has(c.iso) || highlighted.has(c.iso) ? 1 : 0.6}
            className="pointer-events-none select-none font-mono"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}
          >
            {c.iso}
          </text>
        ))}
    </svg>
  );
}

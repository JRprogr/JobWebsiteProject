"use client";

import mapJson from "@/lib/geo/europe-map.json";
import { countryName, type Scope } from "@/lib/geo";

type Tier = "eu" | "europe" | "near";

type MapCountry = {
  iso: string;
  tier: Tier;
  name: string;
  dots: string;
  hit: string;
  area: number;
  label: [number, number] | null;
};

// Slight country outlines around the dot-matrix countries (bug log 11). One switch: false turns them off again.
const SHOW_BORDERS = true;

const map = mapJson as unknown as { w: number; h: number; graticule: string; countries: MapCountry[] };

// EU only lights the 27 members, Europe adds the rest of the EEA, UK, Switzerland and the Balkans (Russia, Turkey, Ukraine,
// Belarus and Moldova stay grey), Global lights everything (each country then shows whether it has openings)
function isLit(tier: Tier, scope: Scope): boolean {
  if (scope === "eu") return tier === "eu";
  if (scope === "europe") return tier !== "near";
  return true;
}

type Props = {
  scope: Scope;
  counts: Record<string, number>;
  selected: ReadonlySet<string>;
  highlighted: ReadonlySet<string>;
  hovered: string | null;
  onHover: (iso: string | null) => void;
  onToggle: (iso: string) => void;
};

// Malta, Luxembourg and Liechtenstein are smaller than a single map dot, so their real outline is (almost) impossible to
// hit. They get an invisible round target around their dot instead; Malta has no land neighbours to steal, so it gets a wider one.
const isTiny = (c: MapCountry) => !c.dots && c.label !== null;
const tinyRadius = (c: MapCountry) => (c.iso === "MT" ? 8 : 4.5);

export function EuMap({ scope, counts, selected, highlighted, hovered, onHover, onToggle }: Props) {
  const pointer = (iso: string) => ({
    onClick: () => onToggle(iso),
    onPointerEnter: () => onHover(iso),
    onPointerLeave: () => onHover(null),
  });

  return (
    <svg viewBox={`0 0 ${map.w} ${map.h}`} className="block h-full w-full" role="group" aria-label="Map of Europe. Select countries to filter roles.">
      <path d={map.graticule} fill="none" stroke="var(--map-grat)" strokeWidth={0.7} />
      {/* country outlines, drawn under the dots; to revert: set SHOW_BORDERS to false (or delete this block and the .map-border rule in globals.css) */}
      {SHOW_BORDERS
        ? map.countries.map((c) => <path key={`border-${c.iso}`} className="map-border" d={c.hit} aria-hidden="true" />)
        : null}
      {map.countries.map((c) => {
        const count = counts[c.iso] ?? 0;
        const active = selected.has(c.iso) || highlighted.has(c.iso);
        const lit = active || isLit(c.tier, scope);
        const fallbackDot = !c.dots && c.label ? `M${c.label[0]} ${c.label[1]}h0` : "";
        return (
          <g key={c.iso} className="map-country" data-tier={c.tier} data-lit={lit} data-empty={count === 0} data-active={active} data-hover={hovered === c.iso}>
            <path className="map-dots" d={c.dots || fallbackDot} />
            <path
              className="map-hit"
              d={c.hit}
              role="button"
              tabIndex={0}
              aria-pressed={selected.has(c.iso)}
              aria-label={`${countryName(c.iso)}, ${count} ${count === 1 ? "role" : "roles"}`}
              {...pointer(c.iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(c.iso);
                }
              }}
              onFocus={() => onHover(c.iso)}
              onBlur={() => onHover(null)}
            />
          </g>
        );
      })}
      {map.countries.filter(isTiny).map((c) => (
        <circle key={`hit-${c.iso}`} cx={c.label![0]} cy={c.label![1]} r={tinyRadius(c)} className="map-hit" aria-hidden="true" {...pointer(c.iso)} />
      ))}
      {map.countries
        .filter((c) => c.area > 380 && c.label)
        .map((c) => {
          const active = selected.has(c.iso) || highlighted.has(c.iso);
          const lit = active || isLit(c.tier, scope);
          return (
            <text
              key={c.iso}
              x={c.label![0]}
              y={c.label![1] + 3}
              textAnchor="middle"
              fill="var(--map-ticker)"
              opacity={active ? 1 : lit ? 0.85 : 0.35}
              className="pointer-events-none select-none font-mono"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}
            >
              {c.iso}
            </text>
          );
        })}
    </svg>
  );
}

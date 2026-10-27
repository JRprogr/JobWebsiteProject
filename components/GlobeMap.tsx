"use client";

import { useEffect, useRef, useState } from "react";
import { countryName, type Scope } from "@/lib/geo";
import { COUNTRIES, createGlobe, viewFor, type Globe } from "./globeEngine";

type Props = {
  scope: Scope;
  counts: Record<string, number>;
  selected: readonly string[]; // in the order they were picked: the globe turns to the last one
  highlighted: readonly string[];
  hovered: string | null;
  onHover: (iso: string | null) => void;
  onToggle: (iso: string) => void;
};

const zoomButton =
  "grid size-7 place-items-center rounded-[7px] border border-map-ui-line bg-map-ui-faint font-mono text-sm leading-none text-map-ui";

export function GlobeMap({ scope, counts, selected, highlighted, hovered, onHover, onToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const handlers = useRef({ onHover, onToggle });
  // keyboard focus on a country in the list below turns the globe to it, so the focus is visible
  const [peek, setPeek] = useState<string | null>(null);

  useEffect(() => {
    handlers.current = { onHover, onToggle };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const globe = createGlobe(canvas, () => handlers.current);
    globeRef.current = globe;
    return () => {
      globe.destroy();
      globeRef.current = null;
    };
  }, []);

  const active = [...selected, ...highlighted];
  const activeKey = active.join(",");
  useEffect(() => {
    globeRef.current?.setState({ scope, counts, active: new Set(activeKey ? activeKey.split(",") : []), hovered });
  }, [scope, counts, activeKey, hovered]);

  const focusIso = peek ?? selected.at(-1) ?? null;
  useEffect(() => {
    globeRef.current?.flyTo(viewFor(focusIso, scope));
  }, [focusIso, scope]);

  const reachable = COUNTRIES.filter((c) => {
    const lit = scope === "all" || (scope === "eu" ? c.tier === "eu" : c.tier === "eu" || c.tier === "europe");
    return selected.includes(c.iso) || (counts[c.iso] ?? 0) > 0 || (lit && c.tier !== "world");
  });

  return (
    <div className="relative h-full w-full" role="group" aria-label="Globe. Select countries to filter roles.">
      <canvas ref={canvasRef} aria-hidden="true" className="globe-canvas block h-full w-full touch-none select-none font-mono" />
      <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
        <button type="button" className={zoomButton} aria-label="Zoom in" onClick={() => globeRef.current?.zoomBy(1.4)}>
          +
        </button>
        <button type="button" className={zoomButton} aria-label="Zoom out" onClick={() => globeRef.current?.zoomBy(1 / 1.4)}>
          −
        </button>
        <button type="button" className={zoomButton} aria-label="Reset view" onClick={() => globeRef.current?.flyTo(viewFor(selected.at(-1) ?? null, scope))}>
          ⌖
        </button>
      </div>
      <ul className="sr-only" aria-label="Countries">
        {reachable.map((c) => {
          const n = counts[c.iso] ?? 0;
          return (
            <li key={c.iso}>
              <button
                type="button"
                aria-pressed={selected.includes(c.iso)}
                aria-label={`${countryName(c.iso)}, ${n} ${n === 1 ? "role" : "roles"}`}
                onClick={() => onToggle(c.iso)}
                onFocus={() => {
                  setPeek(c.iso);
                  onHover(c.iso);
                }}
                onBlur={() => {
                  setPeek(null);
                  onHover(null);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

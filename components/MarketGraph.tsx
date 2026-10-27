"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CLASSIFICATIONS, classificationLabel } from "@/lib/classifications";
import { countryName } from "@/lib/geo";
import { LINK_KINDS, linkKindLabel, type LinkKind, type MarketData, type MarketLink } from "@/lib/marketTypes";
import { MarketClusterView } from "./MarketClusterView";
import { CSS_COLORS, linkFacts, ORIGIN_LABEL, safeUrl } from "./marketShared";

const chip = "rounded-lg border px-3 py-[7px] font-mono text-[11px] tracking-[0.08em]";

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = () => document.documentElement.dataset.theme ?? "light";

export function MarketGraph({ data }: { data: MarketData }) {
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  const [kinds, setKinds] = useState<Set<LinkKind>>(new Set(LINK_KINDS.map((k) => k.key)));
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [showOutside, setShowOutside] = useState(true);
  const [focusClass, setFocusClass] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light");

  // ---- what is shown ----
  const { visibleNodes, visibleLinks } = useMemo(() => {
    const okNode = (id: string) => {
      const n = nodeById.get(id);
      return n !== undefined && (showOutside || n.slug !== null);
    };
    const byKind = data.links.filter((l) => kinds.has(l.kind) && okNode(l.source) && okNode(l.target));
    const degree = new Map<string, number>();
    for (const l of byKind) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    const nodes = data.nodes.filter((n) => okNode(n.id) && (!linkedOnly || (degree.get(n.id) ?? 0) > 0 || n.id === selectedId));
    const ids = new Set(nodes.map((n) => n.id));
    return { visibleNodes: nodes, visibleLinks: byKind.filter((l) => ids.has(l.source) && ids.has(l.target)) };
  }, [data, nodeById, kinds, linkedOnly, showOutside, selectedId]);

  const adjacency = useMemo(() => {
    const m = new Map<string, MarketLink[]>();
    for (const l of data.links) {
      m.set(l.source, [...(m.get(l.source) ?? []), l]);
      m.set(l.target, [...(m.get(l.target) ?? []), l]);
    }
    return m;
  }, [data.links]);

  const selected = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const selectedLinks = selected ? (adjacency.get(selected.id) ?? []) : [];

  const sortedTable = useMemo(
    () => [...data.links].sort((a, b) => LINK_KINDS.findIndex((k) => k.key === a.kind) - LINK_KINDS.findIndex((k) => k.key === b.kind) || (b.amountUsd ?? 0) - (a.amountUsd ?? 0) || b.weight - a.weight),
    [data.links],
  );
  const toggleKind = (k: LinkKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const counts = useMemo(() => {
    const byClass = new Map<string, number>();
    for (const n of data.nodes) if (n.slug) byClass.set(n.classification ?? "", (byClass.get(n.classification ?? "") ?? 0) + 1);
    return byClass;
  }, [data.nodes]);

  function LinkItem({ l, from }: { l: MarketLink; from: string }) {
    const otherId = l.source === from ? l.target : l.source;
    const other = nodeById.get(otherId);
    return (
      <li className="border-t border-line pt-3 text-sm">
        <p className="font-mono text-[10px] tracking-[0.1em] text-dim">
          {linkKindLabel(l.kind)} {l.source === from ? "→" : "←"} · {ORIGIN_LABEL[l.origin]}
        </p>
        <button type="button" onClick={() => setSelectedId(otherId)} className="text-left font-bold underline underline-offset-4">
          {other?.name ?? "Unknown"}
        </button>
        {linkFacts(l) ? <p className="font-mono text-[11px] text-dim">{linkFacts(l)}</p> : null}
        {l.note ? <p className="mt-1 leading-6 text-dim">{l.note}</p> : null}
        {safeUrl(l.sourceUrl) ? (
          <a href={safeUrl(l.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] tracking-[0.08em] underline underline-offset-4">
            SOURCE ↗
          </a>
        ) : null}
      </li>
    );
  }

  const viewProps = {
    nodes: visibleNodes,
    links: visibleLinks,
    allNodes: data.nodes,
    allLinks: data.links,
    colors: CSS_COLORS,
    theme,
    selectedId,
    hoverId,
    focusClass,
    onHover: setHoverId,
    onSelect: setSelectedId,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Link types">
          {LINK_KINDS.map((k) => (
            <button key={k.key} type="button" aria-pressed={kinds.has(k.key)} onClick={() => toggleKind(k.key)} className={`${chip} flex items-center gap-2 ${kinds.has(k.key) ? "border-fg bg-faint" : "border-line opacity-60"}`}>
              <svg width="26" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="25" y2="4" stroke="currentColor" strokeWidth={k.key === "contract" ? 1 : k.key === "partnership" ? 1.4 : 2.4} strokeDasharray={k.key === "joint_venture" ? "6 3" : k.key === "partnership" ? "2 3" : undefined} />
              </svg>
              {k.label}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-[var(--line)] md:block" aria-hidden="true" />
          <button type="button" aria-pressed={linkedOnly} onClick={() => setLinkedOnly((x) => !x)} className={`${chip} ${linkedOnly ? "border-fg bg-faint" : "border-line"}`}>
            LINKED ONLY
          </button>
          <button type="button" aria-pressed={showOutside} onClick={() => setShowOutside((x) => !x)} className={`${chip} ${showOutside ? "border-fg bg-faint" : "border-line"}`}>
            SHOW BUYERS & COMPANIES NOT ON THE BOARD
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sector focus">
          {CLASSIFICATIONS.map((c) => (
            <button key={c.key} type="button" aria-pressed={focusClass === c.key} onClick={() => setFocusClass(focusClass === c.key ? null : c.key)} className={`${chip} ${focusClass === c.key ? "border-fg bg-faint" : "border-line"}`}>
              {c.label} · {counts.get(c.key) ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass relative overflow-hidden rounded-[22px]" aria-label="Network of companies">
          <MarketClusterView {...viewProps} />
        </section>

        <aside className="glass flex flex-col gap-4 rounded-[22px] p-5 lg:max-h-[760px] lg:overflow-y-auto" aria-label="Details" aria-live="polite">
          <label className="flex flex-col gap-1.5 font-mono text-[11px] tracking-[0.08em]">
            FOCUS A COMPANY
            <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value || null)} className="rounded-lg border border-line bg-[var(--bg)] px-2 py-2 text-xs">
              <option value="">—</option>
              {[...data.nodes].sort((a, b) => a.name.localeCompare(b.name)).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.slug ? "" : " (not on the board)"}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-mono text-[11px] tracking-[0.1em] text-dim">
                  {selected.slug ? classificationLabel(selected.classification ?? "") : selected.type === "buyer" ? "PUBLIC BUYER OR AGENCY" : "NOT ON THE BOARD"}
                  {selected.country ? ` · ${countryName(selected.country).toUpperCase()}` : ""}
                </p>
                <h2 className="font-display text-3xl font-extrabold uppercase leading-none">{selected.name}</h2>
              </div>
              {selected.slug && selected.active ? (
                <Link href={`/?co=${selected.slug}`} className="w-fit rounded-[10px] border border-fg px-3 py-2 font-mono text-[11px] font-bold tracking-[0.08em]">
                  {selected.roles.toLocaleString("en")} OPEN {selected.roles === 1 ? "ROLE" : "ROLES"} →
                </Link>
              ) : selected.slug ? (
                <p className="font-mono text-[11px] tracking-[0.08em] text-dim">LISTED IN THE REGISTER · OPENINGS NOT COLLECTED</p>
              ) : null}
              {selectedLinks.length === 0 ? (
                <p className="text-sm text-dim">No links recorded for this company yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {selectedLinks.map((l) => (
                    <LinkItem key={l.id} l={l} from={selected.id} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm leading-6 text-dim">
              <p>Each company on the board is grouped by what it does. A filled circle has open roles on this site; a ring has none collected or is not on the board at all.</p>
              <p>Lines are ownership or acquisitions, joint ventures, partnerships and contracts. Arrows point from owner to subsidiary and from buyer or prime contractor to supplier.</p>
              <p>Click a company, or pick one above, to see who it is linked to and where each link comes from.</p>
            </div>
          )}
        </aside>
      </div>

      <details className="glass rounded-2xl p-5">
        <summary className="cursor-pointer font-mono text-xs tracking-[0.1em]">TABLE VIEW · {data.links.length} LINKS</summary>
        <div className="scroll-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="font-mono text-[10px] tracking-[0.1em] text-dim">
                <th className="py-2 pr-3">FROM</th>
                <th className="py-2 pr-3">TO</th>
                <th className="py-2 pr-3">TYPE</th>
                <th className="py-2 pr-3">DETAIL</th>
                <th className="py-2">SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((l) => (
                <tr key={l.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">{nodeById.get(l.source)?.name}</td>
                  <td className="py-2 pr-3">{nodeById.get(l.target)?.name}</td>
                  <td className="py-2 pr-3 font-mono text-[11px]">{linkKindLabel(l.kind)}</td>
                  <td className="py-2 pr-3 text-dim">{[linkFacts(l), l.origin === "ted" ? null : l.note].filter(Boolean).join(" · ")}</td>
                  <td className="py-2">
                    {safeUrl(l.sourceUrl) ? (
                      <a href={safeUrl(l.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        {l.origin === "usaspending" ? "USAspending" : l.origin === "ted" ? "TED" : new URL(safeUrl(l.sourceUrl) ?? "https://invalid.invalid").hostname.replace(/^www\./, "")}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

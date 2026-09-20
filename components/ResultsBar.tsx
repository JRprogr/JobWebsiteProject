"use client";

import { SORTS, type Sort } from "@/lib/jobs";

export const PAGE_SIZES = [20, 50, 100] as const;

type Props = {
  total: number;
  summary: string;
  sort: Sort;
  limit: number;
  onSort: (sort: Sort) => void;
  onLimit: (limit: number) => void;
};

export function ResultsBar({ total, summary, sort, limit, onSort, onLimit }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 font-mono text-[11px] tracking-[0.08em]">
      <span className="text-dim">
        {total.toLocaleString("en")} {total === 1 ? "ROLE" : "ROLES"} · {summary}
      </span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5" role="group" aria-label="Roles per page">
          <span className="text-dim">SHOW</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={limit === n}
              onClick={() => onLimit(n)}
              className={`rounded-md border px-2 py-1 ${limit === n ? "border-fg bg-faint font-bold" : "border-line"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-dim">SORT</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as Sort)}
            className="rounded-md border border-line bg-transparent px-2 py-1 font-mono text-[11px] tracking-[0.08em] outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-bg text-fg">
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

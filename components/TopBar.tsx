"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SCOPES, type Scope } from "@/lib/geo";
import { SearchIcon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { useFilterNav } from "./useFilterNav";

export function TopBar({ query, scope }: { query: string; scope: Scope }) {
  const { update } = useFilterNav();
  const [text, setText] = useState(query);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => update({ q: text.trim() || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the typed text changes
  }, [text]);

  return (
    <header className="sticky top-0 z-30 border-b border-line backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }}>
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 md:h-[72px] md:gap-7 md:px-12">
        <Link href="/" className="whitespace-nowrap font-logo text-2xl tracking-[0.02em] md:text-[30px]" aria-label="DS[Careers] home">
          DS[Careers]
        </Link>
        <label className="glass flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-3.5 md:max-w-[300px] md:flex-none md:basis-[300px]">
          <SearchIcon className="shrink-0 text-dim" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search jobs"
            aria-label="Search roles, companies, places"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-dim"
          />
        </label>
        <nav aria-label="Region scope" className="ml-auto hidden items-center gap-2 lg:flex">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={scope === s.value}
              onClick={() => update({ scope: s.value === "europe" ? null : s.value, c: null })}
              className={`rounded-[9px] border px-3 py-2 font-mono text-[11px] tracking-[0.08em] ${scope === s.value ? "border-fg bg-faint" : "border-line"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto lg:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

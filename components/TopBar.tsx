"use client";

import Link from "next/link";
import { SCOPES, type Scope } from "@/lib/geo";
import { ThemeToggle } from "./ThemeToggle";
import { useFilterNav } from "./useFilterNav";

export function TopBar({ scope }: { scope: Scope }) {
  const { update } = useFilterNav();
  return (
    <header className="sticky top-0 z-30 border-b border-line backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }}>
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 md:h-[72px] md:gap-7 md:px-12">
        <Link href="/" className="whitespace-nowrap font-logo text-2xl tracking-[0.02em] md:text-[30px]" aria-label="DS[Careers] home">
          DS[Careers]
        </Link>
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

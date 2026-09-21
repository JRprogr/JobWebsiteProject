"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const PAGES = [
  { href: "/", label: "OVERVIEW" },
  { href: "/statistics", label: "STATISTICS" },
  { href: "/companies", label: "COMPANY REGISTER" },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:h-[72px] md:flex-nowrap md:gap-7 md:px-12 md:py-0">
        <Link href="/" className="whitespace-nowrap font-logo text-2xl tracking-[0.02em] md:text-[30px]" aria-label="DS[Careers] home">
          DS[Careers]
        </Link>
        <nav aria-label="Pages" className="order-last flex w-full items-center justify-between gap-1 md:order-none md:ml-auto md:w-auto md:justify-start md:gap-2">
          {PAGES.map((p) => {
            const current = pathname === p.href;
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={current ? "page" : undefined}
                className={`whitespace-nowrap rounded-[9px] border px-2 py-1.5 font-mono text-[10px] tracking-[0.06em] md:px-3 md:py-2 md:text-[11px] md:tracking-[0.08em] ${current ? "border-fg bg-faint font-bold" : "border-transparent text-dim hover:border-line"}`}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto md:ml-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

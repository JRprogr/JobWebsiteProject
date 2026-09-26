"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Same bracketed text link as the footer's [ ABOUT ], shown under the tip button
export function AboutButton() {
  const current = usePathname() === "/about";
  return (
    <Link
      href="/about"
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-6 items-center whitespace-nowrap font-mono text-[11px] tracking-[0.08em] hover:text-fg ${current ? "font-bold text-fg" : "text-dim"}`}
    >
      [ ABOUT ]
    </Link>
  );
}

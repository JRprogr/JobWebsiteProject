"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InfoIcon } from "./icons";
import { headerButton } from "./TipButton";

export function AboutButton() {
  const current = usePathname() === "/about";
  return (
    <Link
      href="/about"
      aria-current={current ? "page" : undefined}
      title="About DS[Careers]"
      aria-label="About DS[Careers]"
      className={`${headerButton} ${current ? "border-fg bg-faint font-bold" : "border-line text-dim"}`}
    >
      <InfoIcon size={15} />
      <span className="hidden sm:inline">ABOUT</span>
    </Link>
  );
}

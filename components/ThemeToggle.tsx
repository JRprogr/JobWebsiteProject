"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const night = theme === "dark";

  function toggle() {
    const next: Theme = night ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={night}
      aria-label="Night mode"
      className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em]"
    >
      <span className="max-sm:hidden" suppressHydrationWarning>
        {night ? "NIGHT" : "DAY"}
      </span>
      <span className="relative block h-7 w-14 rounded-full border border-line bg-faint">
        <span
          className={`absolute top-[3px] grid size-5 place-items-center rounded-full bg-accent text-on-accent transition-all duration-200 ${
            night ? "left-[calc(100%-23px)]" : "left-[3px]"
          }`}
        >
          {night ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
    </button>
  );
}

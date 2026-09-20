"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";
import { useFilterNav } from "./useFilterNav";

export function SearchBar({ query }: { query: string }) {
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
    <label className="glass flex h-12 items-center gap-3 rounded-xl px-4">
      <SearchIcon className="shrink-0 text-dim" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search job titles"
        aria-label="Search job titles"
        className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-dim"
      />
    </label>
  );
}

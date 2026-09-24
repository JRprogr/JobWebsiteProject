import { TIP_LABEL, TIP_URL } from "@/lib/site";
import { CoffeeIcon } from "./icons";

export function TipButton() {
  return (
    <a
      href={TIP_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Support this project on Ko-fi (opens in a new tab)"
      aria-label="Support this project on Ko-fi (opens in a new tab)"
      className="flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-line px-2.5 py-2 font-mono text-[11px] tracking-[0.08em] text-dim"
    >
      <CoffeeIcon size={15} />
      <span className="hidden sm:inline">{TIP_LABEL}</span>
    </a>
  );
}

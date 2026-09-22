import { TIP_LABEL, TIP_URL } from "@/lib/site";
import { CoffeeIcon } from "./icons";

// Placeholder destination until the tip link is set up (see lib/site.ts)
export function TipButton() {
  return (
    <a
      href={TIP_URL}
      title="Support this project (link coming soon)"
      aria-label="Support this project (link coming soon)"
      className="flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-line px-2.5 py-2 font-mono text-[11px] tracking-[0.08em] text-dim"
    >
      <CoffeeIcon size={15} />
      <span className="hidden sm:inline">{TIP_LABEL}</span>
    </a>
  );
}

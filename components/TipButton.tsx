import { TIP_LABEL, TIP_URL } from "@/lib/site";
import { CoffeeIcon } from "./icons";

const headerButton =
  "flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border px-2.5 font-mono text-[11px] tracking-[0.08em]";

export function TipButton() {
  return (
    <a
      href={TIP_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Support this project on Ko-fi (opens in a new tab)"
      aria-label="Support this project on Ko-fi (opens in a new tab)"
      className={`${headerButton} border-line text-dim`}
    >
      <CoffeeIcon size={15} />
      <span className="hidden sm:inline">{TIP_LABEL}</span>
    </a>
  );
}

import Image from "next/image";

// Logos sit on a white disc in both themes: many are dark marks on transparent, which vanish on the dark theme's glass.
// Decorative — the company name is always printed next to it.
export function CompanyLogo({ name, logo, className }: { name: string; logo: string | null; className: string }) {
  if (!logo) {
    return (
      <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border border-line bg-faint font-mono font-bold ${className}`}>
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`relative shrink-0 overflow-hidden rounded-full border border-line bg-white ${className}`}>
      <Image src={logo} alt="" width={64} height={64} unoptimized className="size-full object-cover" />
    </span>
  );
}

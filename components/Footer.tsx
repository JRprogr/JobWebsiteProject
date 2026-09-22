import Link from "next/link";

const cell = "border-line p-4";
const corner = "absolute size-3.5 border-fg";

const PAGES = [
  { href: "/terms", label: "TERMS" },
  { href: "/faq", label: "Q&A" },
  { href: "/about", label: "ABOUT" },
];

export function Footer() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1440px] px-4 pb-10 md:px-12">
      <div className="border border-line font-mono text-[11px] tracking-[0.08em]">
        <div className="flex flex-col divide-y divide-line border-b border-line sm:flex-row sm:divide-x sm:divide-y-0">
          <p className={`${cell} flex-1 text-dim`}>DATA REFRESHES ON EACH SCRAPE RUN. NO PUSH FEED.</p>
          <p className={`${cell} flex-1 text-dim`}>SOURCES · GREENHOUSE / LEVER / SITEMAPS</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-[1.3fr_1.2fr_0.5fr_0.7fr]">
          <div className={`${cell} col-span-2 flex flex-col justify-end border-b lg:col-span-1 lg:border-b-0 lg:border-r`}>
            <span className="font-logo text-[44px] leading-none">DS[Careers]</span>
          </div>
          <ul className={`${cell} col-span-2 flex flex-col gap-2.5 border-b lg:col-span-1 lg:border-b-0 lg:border-r`}>
            <li>[+] EUROPE FIRST</li>
            <li>[+] EVERY OPEN ROLE LINKS TO THE EMPLOYER</li>
            <li>[+] NO ACCOUNTS, NO TRACKING</li>
          </ul>
          <div className="hazard min-h-24 border-r border-line max-lg:border-b lg:border-r" aria-hidden="true" />
          <div className="relative grid min-h-24 place-items-center p-4 max-lg:border-b border-line">
            <span className={`${corner} left-4 top-4 border-l border-t`} aria-hidden="true" />
            <span className={`${corner} right-4 top-4 border-r border-t`} aria-hidden="true" />
            <span className={`${corner} bottom-4 left-4 border-b border-l`} aria-hidden="true" />
            <span className={`${corner} bottom-4 right-4 border-b border-r`} aria-hidden="true" />
            <p className="text-center leading-7 text-dim">
              SN-DS0001-A
              <br />[ RESERVED ]
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line p-4 text-[10px] text-dim md:flex-row md:items-center md:justify-between">
          <p>© 2026 DS[Careers] · NON-COMMERCIAL PORTFOLIO PROJECT · LISTINGS BELONG TO THEIR EMPLOYERS.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal and info">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="hover:text-fg">
                  [ {p.label} ]
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

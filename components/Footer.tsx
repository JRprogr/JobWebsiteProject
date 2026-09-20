export function Footer() {
  const cell = "border-line";
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1440px] px-4 pb-10 md:px-12">
      <div className="grid grid-cols-1 border border-line font-mono text-[11px] tracking-[0.08em] md:grid-cols-[420px_1fr_260px_260px] md:grid-rows-[44px_1fr_56px]">
        <p className={`flex items-center border-b p-4 md:col-span-2 md:border-r ${cell}`}>
          <span className="text-dim">DATA REFRESHES ON EACH SCRAPE RUN. NO PUSH FEED.</span>
        </p>
        <p className={`flex items-center border-b p-4 md:col-span-2 ${cell}`}>
          <span className="text-dim">SOURCES · GREENHOUSE / LEVER / SITEMAPS</span>
        </p>
        <div className={`flex flex-col justify-end border-b p-4 md:row-span-2 md:border-b-0 md:border-r ${cell}`}>
          <span className="font-logo text-[44px] leading-none">DS[Careers]</span>
        </div>
        <ul className={`flex flex-col gap-2.5 border-b p-4 md:border-r ${cell}`}>
          <li>[+] EUROPE FIRST</li>
          <li>[+] EVERY OPEN ROLE LINKS TO THE EMPLOYER</li>
          <li>[+] NO ACCOUNTS, NO TRACKING</li>
        </ul>
        <div className={`hazard h-16 border-b md:row-span-2 md:h-auto md:border-b-0 md:border-r ${cell}`} aria-hidden="true" />
        <div className="relative grid min-h-28 place-items-center p-4 md:row-span-2">
          <span className="absolute left-5 top-5 size-3.5 border-l border-t border-fg" aria-hidden="true" />
          <span className="absolute right-5 top-5 size-3.5 border-r border-t border-fg" aria-hidden="true" />
          <span className="absolute bottom-5 left-5 size-3.5 border-b border-l border-fg" aria-hidden="true" />
          <span className="absolute bottom-5 right-5 size-3.5 border-b border-r border-fg" aria-hidden="true" />
          <p className="text-center leading-7 text-dim">
            SN-DS0001-A
            <br />[ RESERVED ]
          </p>
        </div>
        <p className={`flex items-center border-t p-4 text-[10px] text-dim md:border-r ${cell}`}>
          NON-COMMERCIAL PORTFOLIO PROJECT. LISTINGS BELONG TO THEIR EMPLOYERS.
        </p>
      </div>
    </footer>
  );
}

"use client";

import { countryName } from "@/lib/geo";
import type { JobView } from "@/lib/jobs";
import { ArrowUpRightIcon, CloseIcon } from "./icons";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="font-mono text-[10px] tracking-[0.1em] text-dim">{label}</dt>
      <dd className="truncate font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}

export function Preview({ job, onClose }: { job: JobView | null; onClose: () => void }) {
  const wrapper = `max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:rounded-b-none max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] ${
    job ? "" : "max-lg:hidden"
  }`;

  if (!job) {
    return (
      <section aria-label="Role preview" className={`relative grid min-h-40 place-items-center rounded-[22px] border border-line p-6 ${wrapper}`}>
        <span className="absolute left-5 top-5 size-3.5 border-l border-t border-fg" aria-hidden="true" />
        <span className="absolute right-5 top-5 size-3.5 border-r border-t border-fg" aria-hidden="true" />
        <span className="absolute bottom-5 left-5 size-3.5 border-b border-l border-fg" aria-hidden="true" />
        <span className="absolute bottom-5 right-5 size-3.5 border-b border-r border-fg" aria-hidden="true" />
        <p className="text-center font-mono text-[11px] leading-7 tracking-[0.12em] text-dim">
          [ SELECT A ROLE ]
          <br />
          DETAILS APPEAR HERE
        </p>
      </section>
    );
  }

  const where = job.countries.length > 0 ? job.countries.map(countryName).join(", ") : (job.locationRaw ?? "—");

  return (
    <section aria-label="Role preview" className={`glass flex flex-col gap-4 rounded-[22px] p-5 lg:p-[22px] ${wrapper}`}>
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="grid size-[52px] shrink-0 place-items-center rounded-full border border-line bg-faint font-mono text-xl font-bold">
          {job.company.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-bold leading-tight lg:text-xl">{job.title}</h2>
          <p className="truncate font-mono text-xs text-dim">
            {job.company.toUpperCase()} · {job.city ? `${job.city}, ` : ""}
            {job.countries[0] ?? "—"}
            {job.remote ? " · REMOTE" : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="pulse grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
          <CloseIcon />
        </button>
      </div>

      <div className="h-px bg-line max-lg:hidden" />
      <dl className="grid grid-cols-3 gap-3 max-lg:hidden">
        <Fact label="SALARY" value={job.salary ?? "—"} />
        <Fact label="POSTED" value={job.ago} />
        <Fact label="SECTOR" value={job.sector ? job.sector.toUpperCase() : "—"} />
      </dl>
      <dl className="grid grid-cols-2 gap-3 max-lg:hidden">
        <Fact label="DEPARTMENT" value={job.department ?? "—"} />
        <Fact label="LOCATION" value={where} />
      </dl>

      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-[46px] items-center justify-center gap-2.5 rounded-xl bg-accent font-mono text-[13px] font-bold tracking-[0.1em] text-on-accent"
      >
        APPLY ON EMPLOYER SITE
        <ArrowUpRightIcon />
      </a>
    </section>
  );
}

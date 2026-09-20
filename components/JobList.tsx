"use client";

import type { JobView } from "@/lib/jobs";
import { ArrowUpRightIcon } from "./icons";

export function locationLabel(job: JobView): string {
  const code = job.countries[0];
  const extra = job.countries.length > 1 ? ` +${job.countries.length - 1}` : "";
  if (job.city && code) return `${code} ${job.city}${extra}`;
  if (code) return `${code}${extra}`;
  return job.locationRaw ?? "Location n/a";
}

type Props = {
  jobs: JobView[];
  selectedId: string | null;
  pending: boolean;
  onSelect: (id: string | null) => void;
};

export function JobList({ jobs, selectedId, pending, onSelect }: Props) {
  return (
    <ul
      className="job-list flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-60"
      data-has-selection={selectedId !== null}
      data-pending={pending}
      aria-busy={pending}
    >
      {jobs.map((job) => {
        const selected = job.id === selectedId;
        return (
          <li key={job.id} className="job-row glass relative" data-selected={selected}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : job.id)}
              className="flex w-full items-center gap-3 rounded-[16px] py-3 pl-4 pr-16 text-left sm:gap-4 sm:pl-5 sm:pr-[76px]"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-faint font-mono text-base font-bold"
              >
                {job.company.charAt(0)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[17px] font-semibold leading-tight">{job.title}</span>
                <span className="truncate font-mono text-xs leading-tight text-dim">
                  {job.company.toUpperCase()} · <span className="font-bold text-fg">{locationLabel(job)}</span>
                  {job.remote ? " · Remote" : ""} · {job.ago}
                  {job.salary ? ` · ${job.salary}` : ""}
                </span>
              </span>
              {job.sector ? (
                <span className="hidden shrink-0 rounded-md border border-line bg-faint px-2 py-1 font-mono text-[11px] tracking-[0.08em] lg:block">
                  {job.sector.toUpperCase()}
                </span>
              ) : null}
            </button>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Apply: ${job.title} at ${job.company} (opens employer site)`}
              className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full sm:right-5"
            >
              <span className="grid size-9 place-items-center rounded-full bg-accent text-on-accent">
                <ArrowUpRightIcon />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

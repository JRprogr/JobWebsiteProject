"use client";

import { useEffect, useRef, useState } from "react";
import type { JobView } from "@/lib/jobs";
import { ArrowUpRightIcon, CloseIcon } from "./icons";

type State = { status: "loading" } | { status: "ready"; text: string } | { status: "error"; message: string };

// Mounted only while open, so each opening starts from a clean loading state
export function DetailsModal({ job, onClose }: { job: JobView; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/jobs/${job.id}/details`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !body.text) throw new Error(body.error ?? "No listing text available");
        setState({ status: "ready", text: body.text });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Could not load the listing" });
      });
    return () => controller.abort();
  }, [job.id]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-labelledby="details-title"
      className="m-auto w-[min(760px,calc(100vw-1.5rem))] max-w-none overflow-visible bg-transparent p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="glass flex max-h-[85dvh] flex-col overflow-hidden rounded-[22px] bg-bg" style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}>
        <header className="flex items-start gap-4 border-b border-line p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="font-mono text-[11px] tracking-[0.1em] text-dim">{job.company.toUpperCase()}</p>
            <h2 id="details-title" className="text-xl font-bold leading-tight">
              {job.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close full listing" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
            <CloseIcon />
          </button>
        </header>

        <div className="scroll-thin min-h-40 flex-1 overflow-y-auto p-5" aria-live="polite">
          {state.status === "loading" ? <p className="font-mono text-xs tracking-[0.1em] text-dim">LOADING LISTING…</p> : null}
          {state.status === "error" ? (
            <p className="font-mono text-xs leading-6 tracking-[0.06em]">
              {state.message.toUpperCase()}.
              <br />
              <span className="text-dim">OPEN THE EMPLOYER PAGE INSTEAD.</span>
            </p>
          ) : null}
          {state.status === "ready" ? <div className="whitespace-pre-line text-[15px] leading-7">{state.text}</div> : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line p-4">
          <p className="hidden font-mono text-[10px] tracking-[0.08em] text-dim sm:block">TEXT COPIED FROM THE EMPLOYER LISTING</p>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex h-11 items-center gap-2.5 rounded-xl bg-accent px-5 font-mono text-[13px] font-bold tracking-[0.1em] text-on-accent"
          >
            APPLY ON EMPLOYER SITE
            <ArrowUpRightIcon />
          </a>
        </footer>
      </div>
    </dialog>
  );
}

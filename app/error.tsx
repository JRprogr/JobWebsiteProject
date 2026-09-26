"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TopBar } from "@/components/TopBar";

// Shown when a page fails while rendering (typically the database being unreachable). The footer is a server component that
// asks the database itself, so this page brings only the top bar.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <TopBar />
      <main id="main-content" className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 py-20 md:px-12">
        <p className="font-mono text-xs tracking-[0.12em] text-dim">[ 500 · SIGNAL DEGRADED ]</p>
        <h1 className="mt-3.5 font-display text-[clamp(40px,8vw,72px)] font-extrabold uppercase leading-[0.95] tracking-[0.01em]">
          Something broke on our side.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-dim">
          This page could not be loaded, most likely because of a short outage behind the scenes. Nothing you did caused it. Try again
          in a moment.
          {error.digest ? <span className="mt-2 block font-mono text-xs tracking-[0.06em]">Reference: {error.digest}</span> : null}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-11 items-center rounded-xl bg-accent px-6 font-mono text-[12px] font-bold tracking-[0.08em] text-on-accent"
          >
            TRY AGAIN
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl border border-fg px-6 font-mono text-[12px] font-bold tracking-[0.08em]"
          >
            RETURN TO OVERVIEW
          </Link>
        </div>
      </main>
    </>
  );
}

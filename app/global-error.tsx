"use client";

// Last resort when the root layout itself fails. It replaces the whole document, so it carries its own tiny stylesheet
// (no fonts, no app CSS) and follows the operating system's light or dark setting.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something broke · DS[Careers]</title>
        <style>{`
          :root { color-scheme: light dark; --bg: #f7f9fe; --fg: #0b1020; --dim: #4a5168; --accent: #0b1020; --on: #ffffff; }
          @media (prefers-color-scheme: dark) { :root { --bg: #050505; --fg: #f2f2f2; --dim: #a8a8a8; --accent: #f2f2f2; --on: #050505; } }
          body { margin: 0; min-height: 100dvh; display: grid; place-content: center; padding: 24px; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; line-height: 1.6; }
          main { max-width: 34rem; }
          p.eyebrow { font-family: ui-monospace, monospace; font-size: 12px; letter-spacing: 0.12em; color: var(--dim); }
          h1 { font-size: clamp(32px, 7vw, 56px); line-height: 1; margin: 12px 0 16px; text-transform: uppercase; }
          p { color: var(--dim); }
          button, a.link { display: inline-block; margin: 24px 12px 0 0; padding: 12px 24px; border-radius: 12px; font: 700 12px ui-monospace, monospace; letter-spacing: 0.08em; text-decoration: none; cursor: pointer; }
          button { background: var(--accent); color: var(--on); border: 0; }
          a.link { border: 1px solid var(--fg); color: var(--fg); }
          :focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
        `}</style>
      </head>
      <body>
        <main>
          <p className="eyebrow">[ 500 · SIGNAL LOST ]</p>
          <h1>Something broke on our side.</h1>
          <p>
            The site could not be displayed. This is usually a short outage; nothing you did caused it.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button type="button" onClick={() => retry()}>
            TRY AGAIN
          </button>
          {/* a full page load on purpose: with a broken root layout, client-side navigation cannot be trusted */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="link" href="/">
            RETURN TO OVERVIEW
          </a>
        </main>
      </body>
    </html>
  );
}

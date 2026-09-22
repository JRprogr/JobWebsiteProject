import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

type Props = { eyebrow: string; title: string; intro?: string; children: React.ReactNode };

export function PageShell({ eyebrow, title, intro, children }: Props) {
  return (
    <>
      <TopBar />
      <main id="main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-4 pt-8 md:px-12 md:pt-10">
        <div className="flex flex-col gap-3.5">
          <p className="font-mono text-xs tracking-[0.12em] text-dim">{eyebrow}</p>
          <h1 className="font-display text-[clamp(44px,9vw,84px)] font-extrabold uppercase leading-[0.92] tracking-[0.01em]">{title}</h1>
          {intro ? <p className="max-w-2xl text-[15px] leading-7 text-dim">{intro}</p> : null}
        </div>
        <div className="mt-8 flex flex-col gap-5 md:mt-10">{children}</div>
      </main>
      <Footer />
    </>
  );
}

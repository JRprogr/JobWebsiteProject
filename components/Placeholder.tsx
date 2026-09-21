import { Footer } from "./Footer";
import { TopBar } from "./TopBar";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 md:px-12 md:pt-10">
        <p className="font-mono text-xs tracking-[0.12em] text-dim">[ COMING SOON ]</p>
        <h1 className="mt-3.5 font-display text-[clamp(44px,9vw,84px)] font-extrabold uppercase leading-[0.92] tracking-[0.01em]">{title}</h1>
        <p className="glass mt-8 max-w-xl rounded-2xl p-6 font-mono text-xs leading-7 tracking-[0.06em]">{note}</p>
      </main>
      <Footer />
    </>
  );
}

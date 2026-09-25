import Link from "next/link";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Not found" };
// the footer shows the last scrape time, so refresh this static page every ten minutes
export const revalidate = 600;

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main id="main-content" className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 py-20 md:px-12">
        <p className="font-mono text-xs tracking-[0.12em] text-dim">[ 404 · SIGNAL LOST ]</p>
        <h1 className="mt-3.5 font-display text-[clamp(40px,8vw,72px)] font-extrabold uppercase leading-[0.95] tracking-[0.01em]">
          Nothing at this coordinate.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-dim">
          The page you&apos;re looking for doesn&apos;t exist, or the listing behind it was removed on a later scrape.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 w-fit items-center rounded-xl bg-accent px-6 font-mono text-[12px] font-bold tracking-[0.08em] text-on-accent"
        >
          RETURN TO OVERVIEW
        </Link>
      </main>
      <Footer />
    </>
  );
}

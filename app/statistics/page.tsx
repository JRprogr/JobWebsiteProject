import { PageShell } from "@/components/PageShell";
import { StatsView } from "@/components/StatsView";
import { loadStats, parseRange } from "@/lib/stats";

export const metadata = { title: "Statistics · DS[Careers]" };

export default async function StatisticsPage({ searchParams }: PageProps<"/statistics">) {
  const sp = await searchParams;
  const raw = sp.range;
  const range = parseRange(Array.isArray(raw) ? raw[0] : raw);
  const stats = await loadStats(range);

  return (
    <PageShell
      eyebrow={`[ STATISTICS${stats.overview.lastScrape ? "" : " · NO DATA YET"} ]`}
      title="Market pulse."
      intro="How many roles are open, which employers are hiring and how fast the picture changes. Counts come from our own scrapes, so history starts on the day each company was first added."
    >
      <StatsView stats={stats} range={range} />
    </PageShell>
  );
}

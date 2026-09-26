import { PageShell } from "@/components/PageShell";
import { StatsView } from "@/components/StatsView";
import { loadStats, parseRange } from "@/lib/stats";

export const metadata = { title: "Statistics" };

export default async function StatisticsPage({ searchParams }: PageProps<"/statistics">) {
  const sp = await searchParams;
  const raw = sp.range;
  const range = parseRange(Array.isArray(raw) ? raw[0] : raw);
  const stats = await loadStats(range);

  return (
    <PageShell
      eyebrow={`[ STATISTICS${stats.overview.lastScrape ? "" : " · NO DATA YET"} ]`}
      title="Market pulse."
      intro="See how many roles are open, which employers are hiring and how fast the picture changes. Counts come from our own refreshes, so history starts on the day each company was first added."
    >
      <StatsView stats={stats} range={range} />
    </PageShell>
  );
}

import { MarketGraph } from "@/components/MarketGraph";
import { PageShell } from "@/components/PageShell";
import { loadMarket } from "@/lib/market";

export const metadata = { title: "Market insight [BETA]" };
export const revalidate = 600;

export default async function MarketPage() {
  const data = await loadMarket();
  return (
    <PageShell
      eyebrow={`[ MARKET INSIGHT [BETA] · ${data.nodes.filter((n) => n.slug).length} COMPANIES · ${data.links.length} LINKS ]`}
      title="Who is who."
      intro="The industry as a network: every company on the board grouped by what it does, and the ownership, joint-venture, partnership and contract links between them, from ESA and EU programmes to defence procurement."
    >
      <MarketGraph data={data} />
      <p className="max-w-3xl text-xs leading-6 text-dim">
        Ownership, joint-venture, partnership and programme links (ESA, the EU, IRIS², Galileo, Moonlight and others) are collected by hand from public announcements; each one links to its source. Public contracts come from TED, the EU&apos;s procurement journal (awards by ministries of defence, space agencies and EU bodies to the companies on the board, last four years, one line per buyer), and from USAspending.gov, the US government&apos;s open record of federal awards (the biggest subcontracts of the last five years, at company level: a group&apos;s figures include every division). ESA&apos;s own contracts are not published as open data, so they are entered from announcements. The picture is incomplete by design. Not an investment or legal resource.
      </p>
    </PageShell>
  );
}

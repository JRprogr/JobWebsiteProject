import { Board } from "@/components/Board";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { parseScope } from "@/lib/geo";
import { allCountryFacets, countryFacets, headline, listJobs, sectors, type Filters } from "@/lib/jobs";

const PAGE = 50;

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const filters: Filters = {
    q: (one("q") ?? "").trim().slice(0, 80),
    sector: one("sector")?.slice(0, 40) || null,
    scope: parseScope(one("scope")),
    countries: (one("c") ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c))
      .slice(0, 12),
    remote: one("remote") === "1",
    newOnly: one("tab") === "new",
  };
  const limit = Math.min(500, Math.max(PAGE, Number.parseInt(one("limit") ?? "", 10) || PAGE));

  const [{ jobs, total }, facets, globalFacets, sectorList, head] = await Promise.all([
    listJobs(filters, limit),
    countryFacets(filters),
    allCountryFacets(filters),
    sectors(),
    headline(),
  ]);

  return (
    <>
      <TopBar scope={filters.scope} />
      <Board
        jobs={jobs}
        total={total}
        limit={limit}
        filters={filters}
        facets={facets}
        globalFacets={globalFacets}
        sectors={sectorList}
        headline={head}
      />
      <Footer />
    </>
  );
}

import { Board } from "@/components/Board";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { parseBucket } from "@/lib/experience";
import { parseScope } from "@/lib/geo";
import { allCountryFacets, companyFacets, countryFacets, headline, listJobs, parseSort, sectors, type Filters } from "@/lib/jobs";

const DEFAULT_LIMIT = 20;

const list = (value: string | undefined, pattern: RegExp, max: number) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => pattern.test(v))
    .slice(0, max);

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
    countries: list(one("c")?.toUpperCase(), /^[A-Z]{2}$/, 12),
    companies: list(one("co"), /^[a-z0-9-]{1,60}$/, 20),
    experience: parseBucket(one("exp")),
    sort: parseSort(one("sort")),
    remote: one("remote") === "1",
    newOnly: one("tab") === "new",
  };
  const limit = Math.min(500, Math.max(20, Number.parseInt(one("limit") ?? "", 10) || DEFAULT_LIMIT));

  const [{ jobs, total }, facets, globalFacets, companyList, sectorList, head] = await Promise.all([
    listJobs(filters, limit),
    countryFacets(filters),
    allCountryFacets(filters),
    companyFacets(filters),
    sectors(),
    headline(),
  ]);

  return (
    <>
      <TopBar />
      <main id="main-content" className="contents">
        <Board
          jobs={jobs}
          total={total}
          limit={limit}
          filters={filters}
          facets={facets}
          globalFacets={globalFacets}
          companyFacets={companyList}
          sectors={sectorList}
          headline={head}
        />
      </main>
      <Footer />
    </>
  );
}

import { PageShell } from "@/components/PageShell";
import { RegisterView } from "@/components/RegisterView";
import { loadRegister } from "@/lib/stats";
import { sortClassifications } from "@/lib/classifications";

export const metadata = { title: "Company Register" };

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.classification) ? sp.classification[0] : sp.classification;
  const companies = await loadRegister();
  const classifications = sortClassifications([...new Set(companies.map((c) => c.classification).filter((s): s is string => s !== null))]);
  const classification = raw && classifications.includes(raw) ? raw : null;

  return (
    <PageShell
      eyebrow="[ COMPANY REGISTER ]"
      title="Who is hiring."
      intro="Every space and defence employer we follow, with the number of open roles and a direct link to their own careers page."
    >
      <RegisterView companies={companies} classifications={classifications} classification={classification} />
    </PageShell>
  );
}

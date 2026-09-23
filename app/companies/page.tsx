import { PageShell } from "@/components/PageShell";
import { RegisterView } from "@/components/RegisterView";
import { loadRegister } from "@/lib/stats";
import { sortSectors } from "@/lib/sectors";

export const metadata = { title: "Company Register" };

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.sector) ? sp.sector[0] : sp.sector;
  const companies = await loadRegister();
  const sectors = sortSectors([...new Set(companies.map((c) => c.sector).filter((s): s is string => s !== null))]);
  const sector = raw && sectors.includes(raw) ? raw : null;

  return (
    <PageShell
      eyebrow="[ COMPANY REGISTER ]"
      title="Who is hiring."
      intro="Every space and defence employer we follow, with the number of open roles and a direct link to their own careers page."
    >
      <RegisterView companies={companies} sectors={sectors} sector={sector} />
    </PageShell>
  );
}

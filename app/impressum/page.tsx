import { ContactEmail } from "@/components/ContactEmail";
import { LegalSection } from "@/components/LegalSection";
import { OperatorBlock } from "@/components/Address";
import { PageShell } from "@/components/PageShell";

export const metadata = { title: "Impressum" };
// the footer shows the last scrape time, so refresh this static page every ten minutes
export const revalidate = 600;

export default function ImpressumPage() {
  return (
    <PageShell eyebrow="[ LEGAL · IMPRESSUM ]" title="Impressum." intro="Legal notice and provider information, as required for websites offered from Germany.">
      <LegalSection title="PROVIDER (§ 5 DDG)">
        <OperatorBlock />
      </LegalSection>

      <LegalSection title="CONTACT">
        <p>
          Email: <ContactEmail />
        </p>
      </LegalSection>

      <LegalSection title="RESPONSIBLE FOR CONTENT (§ 18 (2) MSTV)">
        <OperatorBlock />
      </LegalSection>

      <LegalSection title="LIABILITY FOR CONTENT AND LINKS">
        <p>
          The job listings shown here are collected automatically from the employers&apos; own public career pages and
          belong to those employers; the employer&apos;s own listing is always the authoritative version. Links to
          external sites lead to content we don&apos;t control, and we take no responsibility for it. If you notice
          a listing or link that should be corrected or removed, please write to us at <ContactEmail /> and we&apos;ll
          look into it promptly.
        </p>
      </LegalSection>
    </PageShell>
  );
}

import { LegalSection } from "@/components/LegalSection";
import { PageShell } from "@/components/PageShell";
import { ContactEmail } from "@/components/ContactEmail";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="[ LEGAL ]"
      title="Terms."
      intro="This is a solo, non-commercial portfolio project. The summary below explains how the site works and what it isn't — it's written in plain language, not by a lawyer."
    >
      <LegalSection title="WHAT THIS IS">
        <p>
          DS[Careers] is a portfolio project that collects publicly posted job listings from space and defence company
          career pages, with a focus on roles in continental Europe. It is not a company, does not charge for access,
          and does not run ads.
        </p>
      </LegalSection>

      <LegalSection title="DATA & ACCURACY">
        <p>
          Listings are gathered automatically from each employer&apos;s own career page or applicant tracking system,
          on a schedule, not in real time. A listing shown here can be outdated, incomplete, or already filled before
          our next check. <b>Always treat the employer&apos;s own listing as the source of truth</b>, and apply there —
          every <b>Apply</b> or <b>Full listing</b> button links directly to it.
        </p>
      </LegalSection>

      <LegalSection title="NO AFFILIATION">
        <p>
          DS[Careers] is not affiliated with, endorsed by, or sponsored by any company whose listings appear here.
          Company names and any logos are used only to identify the employer of a given role and remain the property
          of their respective owners.
        </p>
      </LegalSection>

      <LegalSection title="THIRD-PARTY LINKS">
        <p>
          Applying, viewing a full listing, or opening a company&apos;s careers page takes you to a site we don&apos;t
          control. We aren&apos;t responsible for the content, accuracy, or practices of those sites.
        </p>
      </LegalSection>

      <LegalSection title="NO WARRANTY">
        <p>
          The site is provided &ldquo;as is&rdquo;, without any guarantee that it will be available, accurate, or
          error-free. To the extent the law allows, we aren&apos;t liable for damages arising from your use of, or
          reliance on, this site.
        </p>
      </LegalSection>

      <LegalSection title="TAKEDOWN & CORRECTIONS">
        <p>
          If you represent a listed employer, hold rights to something shown here, or spot a listing that should be
          corrected or removed, contact <b><ContactEmail /></b> and we&apos;ll act on it promptly.
        </p>
      </LegalSection>

      <LegalSection title="CHANGES">
        <p>These terms may change as the project develops. Check back here for the current version.</p>
      </LegalSection>

      <LegalSection title="CONTACT">
        <p><ContactEmail /></p>
      </LegalSection>
    </PageShell>
  );
}

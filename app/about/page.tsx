import { LegalSection } from "@/components/LegalSection";
import { PageShell } from "@/components/PageShell";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PageShell eyebrow="[ ABOUT ]" title="About the project." intro="Why DS[Careers] exists, and how it's built.">
      <LegalSection title="THE IDEA">
        <p>
          Space and defence job postings are scattered across dozens of separate career pages, each with its own
          search, filters and quirks. DS[Careers] pulls the open roles from all of them into one board, so you can
          search, filter and compare in one place instead of checking each company by hand.
        </p>
      </LegalSection>

      <LegalSection title="WHY EUROPE FIRST">
        <p>
          The filters default to continental Europe &mdash; the EEA, the UK, Switzerland and the Balkans &mdash;
          because that&apos;s where relocating for one of these roles is most realistic. Defence and space work
          carries friction a general job board doesn&apos;t: work visas, security clearance requirements, and
          export-control rules that often favour hiring within a shared economic or defence bloc. Taken as a whole,
          Europe has real advantages here &mdash; easier cross-border movement for EU/EEA nationals, a growing base
          of joint defence programmes, and companies, customers and suppliers that increasingly work across borders
          rather than within just one country. This project&apos;s aim is to match people with roles inside that
          European context specifically, not to rank Europe above anywhere else. Nothing is hidden: every country a
          tracked company posts in is still scraped and searchable &mdash; Europe is just the starting lens, not the
          only one.
        </p>
      </LegalSection>

      <LegalSection title="HOW IT WORKS">
        <p>
          A scheduled refresh checks each company&apos;s public career page or applicant tracking system, compares
          what it finds against what we saw last time, and records what was added, what disappeared, and
          what&apos;s still open. That comparison is also what powers the Statistics page &mdash; there&apos;s no
          separate tracking system behind it, just the history of each scrape.
        </p>
        <p>
          Experience level is estimated from each listing&apos;s own text where it isn&apos;t stated outright. Full
          listing text is fetched on demand rather than stored for every role, to keep the project running on a
          lean database operation.
        </p>
      </LegalSection>

      <LegalSection title="WHO BUILT IT">
        <p>A solo portfolio project, built end to end by John and Claude &mdash; scraping and diffing pipeline, database, and the interface itself.</p>
      </LegalSection>

      <LegalSection title="WHAT'S NEXT">
        <p>
          Maybe more companies, other industries, and coverage for career sites beyond the current sources &mdash;
          plus a closer look at region-level filtering on the map. The Company Register and Statistics pages will
          grow alongside the list of companies tracked. Ideas welcome, just shoot {CONTACT_EMAIL}.
        </p>
      </LegalSection>
    </PageShell>
  );
}

import { LegalSection } from "@/components/LegalSection";
import { PageShell } from "@/components/PageShell";
import { ContactEmail } from "@/components/ContactEmail";

export const metadata = { title: "About" };
// the footer shows the last scrape time, so refresh this static page every ten minutes
export const revalidate = 600;

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
          As a European citizen myself, I am ofcourse strongly interested in our joint development. The continent, especially the EU has a unique position in the defence and space sectors. Work visas, security clearance
          requirements, and export-control rules often favour hiring within a shared economic or defence bloc.
          Taken as a whole, Europe has real advantages here: easier cross-border movement for EU/EEA
          nationals, a growing base of joint defence programmes, and companies, customers and suppliers that
          increasingly work across borders rather than within just one country and a growing demand for sovereignty faciliting innovation. This project&apos;s aim is to match
          talent with roles inside that European context specifically, not to rank Europe above anywhere else.
          Nothing is hidden: every country a tracked company publishes listings for is still scraped and searchable; Europe
          is just the starting lens, not the only one. Ofcourse we acknowledge Russia, Turkey, Ukraine, Belarus and Moldova as
          part of continental Europe geographically &mdash; they&apos;re on the map and one filter away too, yet still we have
          to consider the current geopolitical situation and the fact that many of the companies tracked here are not allowed to do business with those countries.
          The project is open to expanding coverage to other regions in the future, but for now, this part of Europe is the focus.
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
        <p>
          A solo portfolio project, built end to end by John and{" "}
          <a href="https://www.anthropic.com" target="_blank" rel="noopener noreferrer">
            Claude
          </a>{" "}
          . That includes everything regarding scraping and diffing pipeline, database and the UI design itself.
        </p>
      </LegalSection>

      <LegalSection title="ACKNOWLEDGEMENTS">
        <p>
          A major source of inspiration for this project, and of many of the companies tracked here, is the{" "}
          <a href="https://europeanspaceflight.com/european-space-industry-map/" target="_blank" rel="noopener noreferrer">
            European Space Industry Map
          </a>{" "}
          by{" "}
          <a href="https://europeanspaceflight.com" target="_blank" rel="noopener noreferrer">
            European Spaceflight
          </a>
          . Thank you for mapping the European space sector so thoroughly and always keeping us up to date with all the latest developments in the industry!
        </p>
        <p>
          If you are even further interested in current space developments and the technology behind them, there is also{" "}
          <a href="https://substack.com/@downlinknewsletter" target="_blank" rel="noopener noreferrer">
            Downlink
          </a>{" "}
          on Substack, a newsletter on space entrepreneurship with a focus on Earth observation companies across the EU.
        </p>
        <p>
          And while researching this project we came across{" "}
          <a href="https://www.space-careers.com/" target="_blank" rel="noopener noreferrer">
            Space-Careers
          </a>
          , which does something similar: a job portal for the space industry aimed at international, English-speaking job seekers. If DS[Careers] doesn&apos;t
          have what you are looking for, it is well worth a look as an alternative.
        </p>
      </LegalSection>

      <LegalSection title="WHAT'S NEXT">
        <p>
          Maybe more companies, other industries, and coverage for career sites beyond the current sources &mdash;
          plus a closer look at region-level filtering on the map. The Company Register and Statistics pages will
          grow alongside the list of companies tracked. Ideas welcome, just shoot <ContactEmail />.
        </p>
      </LegalSection>
    </PageShell>
  );
}

import { LegalSection } from "@/components/LegalSection";
import { PageShell } from "@/components/PageShell";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Q&A" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is DS[Careers]?",
    a: "A job board that pulls open roles from space and defence company career pages into one place, so you don't have to check each one by hand.",
  },
  {
    q: "Why the focus on Europe?",
    a: "“Europe” here means the EEA, the UK, Switzerland and the Balkans — roughly where a work visa is easier to get and continental relocation is realistic. Every country is still scraped and shown; the region filters just make Europe the default lens.",
  },
  {
    q: "Where does the data come from?",
    a: "Each company's own public career page or applicant tracking system — Greenhouse, Lever, or a company's own listings page for sources without a public API.",
  },
  {
    q: "How often is it updated?",
    a: "“Live” means it reflects the most recent scrape, not a real-time push. Companies are checked on a schedule; the Statistics page shows when each one was last checked.",
  },
  {
    q: "Why do I see US or Asia-based roles if this is a Europe-focused board?",
    a: "Every open role from a tracked company is kept, just classified by region. Roles outside Europe are one filter away — switch to Global, or pick a specific country under Advanced.",
  },
  {
    q: "How is the experience level worked out?",
    a: "It's read from the listing text at scrape time: an explicit range like “5+ years”, or an estimate from cues like “several years of experience” or a senior/junior title. A ~ in front of a value marks an estimate.",
  },
  {
    q: "Can I apply through DS[Careers]?",
    a: "No. Every Apply button opens the employer's own listing, and applications happen there. We don't collect applications, résumés, or accounts.",
  },
  {
    q: "Is DS[Careers] affiliated with the companies listed?",
    a: "No. It's an independent, non-commercial project. See the Terms page for the full disclaimer.",
  },
  {
    q: "I found an outdated or incorrect listing — who do I tell?",
    a: <>Email {CONTACT_EMAIL} with a link to the listing.</>,
  },
  {
    q: "Do you track visitors or require an account?",
    a: "No accounts, no logins, and no analytics or ad tracking. Your browser may keep small, local preferences like your theme choice, which never leave your device.",
  },
  {
    q: "Is this free?",
    a: "Yes, and it always will be. There's an optional tip button if you'd like to support the project; it changes nothing about access.",
  },
  {
    q: "Can I suggest a company to add?",
    a: <>Yes — send it to {CONTACT_EMAIL}.</>,
  },
];

export default function FaqPage() {
  return (
    <PageShell eyebrow="[ Q&A ]" title="Questions." intro="The questions we expect most often, answered directly.">
      {FAQ.map((item) => (
        <LegalSection key={item.q} title={item.q}>
          <p>{item.a}</p>
        </LegalSection>
      ))}
    </PageShell>
  );
}

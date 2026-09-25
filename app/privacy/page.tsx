import { ContactEmail } from "@/components/ContactEmail";
import { LegalSection } from "@/components/LegalSection";
import { OperatorBlock } from "@/components/Address";
import { PageShell } from "@/components/PageShell";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="[ LEGAL · DATENSCHUTZERKLÄRUNG ]"
      title="Privacy."
      intro="What happens to your data when you use DS[Careers]: very little. This is the short version required by the GDPR, written in plain language."
    >
      <LegalSection title="WHO IS RESPONSIBLE">
        <OperatorBlock />
        <p>
          Email: <ContactEmail />
        </p>
      </LegalSection>

      <LegalSection title="NO ACCOUNTS, NO TRACKING, NO COOKIES">
        <p>
          DS[Careers] has no user accounts, no forms that collect personal data, no advertising and no analytics or
          tracking tools. The site sets <b>no cookies</b>.
        </p>
        <p>
          The one thing your browser may store is your theme choice (day or night), saved in your browser&apos;s local
          storage only when you use the theme switch. It never leaves your device and isn&apos;t used to identify you.
          Because you asked for it by using the switch, no consent banner is needed.
        </p>
      </LegalSection>

      <LegalSection title="SERVER LOGS AT OUR HOST">
        <p>
          The site is hosted by Vercel Inc. (USA). When you open a page, the host&apos;s servers process technical
          connection data — your IP address, the requested address, date and time, browser and device information — to
          deliver the site, keep it secure and fix faults. We don&apos;t combine this data with anything else and
          can&apos;t identify you from it. Legal basis: our legitimate interest in running a secure, working website
          (Art. 6(1)(f) GDPR). Vercel keeps such logs only for a limited period set by Vercel. Data may be processed
          outside the EU; Vercel relies on the EU–US Data Privacy Framework and standard contractual clauses for that.
        </p>
      </LegalSection>

      <LegalSection title="THE JOB DATA">
        <p>
          The listings shown here are collected from employers&apos; public career pages and stored in a database
          (Neon, in an EU data centre in Frankfurt, Germany). They describe open roles at companies, not
          people. Your searches and filters are sent to our server only to build the page you asked for and are not
          stored.
        </p>
      </LegalSection>

      <LegalSection title="LINKS TO OTHER SITES">
        <p>
          Apply buttons, company links and the tip button (Ko-fi) lead to sites run by others. Once you follow such a
          link, that site&apos;s own privacy policy applies; we have no influence over what it does with your data.
        </p>
      </LegalSection>

      <LegalSection title="WHEN YOU EMAIL US">
        <p>
          If you write to <ContactEmail />, we use your address and message only to reply and, where needed, to correct
          or remove a listing. Legal basis: our legitimate interest in answering enquiries, or the steps you request
          (Art. 6(1)(f) and (b) GDPR). We delete the correspondence once the matter is settled, unless we&apos;re legally
          required to keep it. Email is handled by Proton (Switzerland).
        </p>
      </LegalSection>

      <LegalSection title="YOUR RIGHTS">
        <p>
          You have the right to access, correct or delete personal data we hold about you, to restrict or object to its
          processing, and to data portability. Write to <ContactEmail /> to use them. You can also complain to a data
          protection supervisory authority — in particular the one in your country of residence or in the place
          where the person responsible for this site is based.
        </p>
      </LegalSection>

      <LegalSection title="CHANGES">
        <p>We&apos;ll update this page if the site starts handling data differently. Last updated: September 2026.</p>
      </LegalSection>
    </PageShell>
  );
}

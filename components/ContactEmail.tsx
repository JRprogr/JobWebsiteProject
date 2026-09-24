import { CONTACT_EMAIL } from "@/lib/site";

export function ContactEmail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

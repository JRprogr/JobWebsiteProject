import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, isEvergreen, politeFetch } from "./http.ts";

type Ad = {
  id: string;
  title: string;
  department?: string | null;
  site?: string | null;
  country?: string | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  publishedAt?: string | null;
  workspaceType?: string | null;
  payTransparencyMinSalary?: number | null;
  payTransparencyMaxSalary?: number | null;
  payTransparencySalaryCurrency?: string | null;
  payTransparencySalaryPayPeriod?: string | null;
};

// HiBob career sites: GET https://<subdomain>.careers.hibob.com/api/job-ad with the header companyIdentifier: <subdomain>
async function ads(company: Pick<Company, "slug" | "source_config">): Promise<Ad[]> {
  const sub = configString(company.source_config, "subdomain", company.slug);
  const res = await politeFetch(`https://${sub}.careers.hibob.com/api/job-ad`, {
    headers: { companyIdentifier: sub, accept: "application/json" },
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`${res.status} for hibob ${sub}`);
  return ((await res.json()) as { jobAdDetails: Ad[] }).jobAdDetails;
}

const bodyText = (a: Ad) => htmlToText([a.description, a.responsibilities, a.requirements, a.benefits].filter(Boolean).join("\n\n"));

// site looks like "Solna (SE)", "Spring House, PA (US)" or an entity name ("SWISSto12 SA - Switzerland"); the country field is a full name
function place(a: Ad): string | null {
  const site = (a.site ?? "").replace(/\s*\(([A-Z]{2})\)\s*$/, "").trim();
  const country = a.country?.trim() ?? "";
  if (!site) return country || null;
  if (country && site.toLowerCase().includes(country.toLowerCase())) return country;
  return country ? `${site}, ${country}` : site;
}

export const hibobDetail: DetailFetcher = async (company, job) => {
  const ad = (await ads(company)).find((a) => a.id === job.external_id);
  return ad ? bodyText(ad) || null : null;
};

export const hibob: Adapter = async (company, ctx) => {
  const sub = configString(company.source_config, "subdomain", company.slug);
  const hint = defaultCountry(company.source_config);
  return (await ads(company))
    .filter((a) => !isEvergreen(a.title))
    .map((a): NormalizedJob => {
      const yearly = a.payTransparencySalaryPayPeriod?.toLowerCase().includes("year");
      return {
        external_id: a.id,
        title: a.title.trim(),
        location_raw: place(a),
        remote: a.workspaceType === "Remote",
        department: a.department ?? null,
        url: `https://${sub}.careers.hibob.com/jobs/${a.id}`,
        salary_min: yearly ? (a.payTransparencyMinSalary ?? null) : null,
        salary_max: yearly ? (a.payTransparencyMaxSalary ?? null) : null,
        salary_currency: yearly ? (a.payTransparencySalaryCurrency ?? null) : null,
        posted_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        country_hint: hint,
        description: ctx.known.has(a.id) ? null : bodyText(a),
      };
    });
};

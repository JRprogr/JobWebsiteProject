import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getJson } from "./http.ts";
import { runBoard, type Row } from "./board.ts";

// Oracle Recruiting Cloud "Candidate Experience" career sites (Honeywell Aerospace: <host>/hcmUI/CandidateExperience/en/sites/<site>): the site's
// own REST service lists requisitions (100 per page) and returns the full listing per requisition. source_config {host, site, site_number}.
type Req = { Id: string; Title: string; PostedDate?: string | null; PrimaryLocation?: string | null; PrimaryLocationCountry?: string | null; WorkplaceType?: string | null; secondaryLocations?: { Name?: string }[] };
type Detail = { ExternalDescriptionStr?: string | null; ExternalResponsibilitiesStr?: string | null; ExternalQualificationsStr?: string | null };

function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  const host = configString(c, "host", company.slug);
  return { host, site: configString(c, "site", company.slug), number: configString(c, "site_number", company.slug), api: `https://${host}/hcmRestApi/resources/latest` };
}

async function listAll(company: Company): Promise<Req[]> {
  const { api, number } = cfg(company);
  const out: Req[] = [];
  for (let offset = 0; offset < 3000; offset += 100) {
    const res = await getJson<{ items: { TotalJobsCount: number; requisitionList: Req[] }[] }>(
      `${api}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${number},limit=100,offset=${offset},sortBy=POSTING_DATES_DESC`,
    );
    const page = res.items[0];
    out.push(...page.requisitionList);
    if (out.length >= page.TotalJobsCount || page.requisitionList.length === 0) break;
  }
  return out;
}

async function fullText(company: Pick<Company, "slug" | "source_config">, id: string): Promise<string | null> {
  const { api, number } = cfg(company);
  const res = await getJson<{ items?: Detail[] }>(`${api}/recruitingCEJobRequisitionDetails?onlyData=true&finder=ById;Id="${id}",siteNumber=${number}`);
  const d = res.items?.[0];
  if (!d) return null;
  return htmlToText([d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr].filter(Boolean).join("\n\n")) || null;
}

export const oraclecloudDetail: DetailFetcher = async (company, job) => fullText(company, job.external_id);

export const oraclecloud: Adapter = async (company, ctx) => {
  const { host, site } = cfg(company);
  const rows = (await listAll(company)).map((r): Row => ({
    id: r.Id,
    url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${r.Id}`,
    title: r.Title,
    // additional sites are listed after the primary one: "Brno, Czech Republic; Praha, Czech Republic"
    location: [r.PrimaryLocation, ...(r.secondaryLocations ?? []).map((l) => l.Name)].filter(Boolean).join("; ") || null,
    remote: /remote/i.test(r.WorkplaceType ?? ""),
    posted: r.PostedDate ? new Date(r.PostedDate).toISOString() : null,
    // ISO-2 from the service: "Kanata, ON, Canada" style names resolve on their own, a bare "India" needs no help either, but the
    // code keeps state abbreviations like ON or IN from being read as US states
    country: r.PrimaryLocationCountry ?? null,
  }));
  return runBoard(company, ctx, rows, (r) => fullText(company, r.id));
};

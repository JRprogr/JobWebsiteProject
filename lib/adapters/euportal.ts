import { htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, politeFetch } from "./http.ts";

// The "Job Opportunities" portal EU agencies run for their vacancies (vacancies.euspa.europa.eu): a Kendo grid fed by
// POST /Home/Index_Binding?showOnly=current, and /Jobs/VacancyDetails/<id> pages. Only rows marked open for applications are listed,
// closed selections stay on the grid for a while. Used as the custom kind "eu-portal".
type Vacancy = { Id: number; Title: string; ReferenceNumber?: string; TypeOfContract?: string; PlaceOfEmployment?: string; AvailableForApplication?: boolean };

const base = (company: { slug: string; source_config: Record<string, unknown> }) => configString(company.source_config, "base", company.slug).replace(/\/$/, "");

async function open(root: string): Promise<Vacancy[]> {
  const res = await politeFetch(`${root}/Home/Index_Binding?showOnly=current`, {
    method: "POST",
    headers: { "x-requested-with": "XMLHttpRequest", "content-type": "application/x-www-form-urlencoded" },
    body: "sort=&page=1&pageSize=100&group=&filter=",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${root}/Home/Index_Binding`);
  return ((await res.json()) as { Data: Vacancy[] }).Data.filter((v) => v.AvailableForApplication);
}

async function vacancyText(url: string): Promise<string | null> {
  const html = await getText(url);
  const at = html.indexOf('id="vacancy-info"');
  if (at < 0) return null;
  const start = html.lastIndexOf("<", at);
  const end = html.indexOf("<footer", start);
  // the page ends with a section index, print button and cookie notice that are not part of the vacancy
  return htmlToText(html.slice(start, end > 0 ? end : undefined)).split(/\n\s*Vacancy sections\s*\n/)[0].trim() || null;
}

export const euPortalDetail: DetailFetcher = async (_company, job) => vacancyText(job.url);

export const euPortal: Adapter = async (company, ctx) => {
  const root = base(company);
  const hint = defaultCountry(company.source_config);
  const jobs: NormalizedJob[] = [];
  for (const v of await open(root)) {
    const id = String(v.Id);
    const url = `${root}/Jobs/VacancyDetails/${id}`;
    let text: string | null = null;
    if (!ctx.known.has(id)) text = await vacancyText(url).catch(() => null);
    const parts = (v.PlaceOfEmployment ?? "").split(" / ").map((p) => p.trim()).filter(Boolean);
    jobs.push({
      external_id: id,
      title: (ctx.known.get(id) ?? v.Title).trim(),
      location_raw: parts.length === 2 ? parts.join(", ") : parts.join("; ") || null,
      remote: false,
      department: v.TypeOfContract ?? null,
      url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
      country_hint: hint,
      description: ctx.known.has(id) ? null : (text ?? ""),
    });
  }
  return jobs;
};

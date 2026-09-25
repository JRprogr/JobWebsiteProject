import { countryName } from "../geo.ts";
import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getJson, isEvergreen } from "./http.ts";

// Jibe (iCIMS Talent Cloud) career sites such as careers.viasat.com: GET <base>/api/jobs?page=N&limit=100, descriptions inline.
type Job = {
  slug?: string;
  req_id: string;
  title: string;
  description?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  posted_date?: string | null;
  employment_type?: string | null;
  categories?: { name: string }[];
  salary_min_value?: number | null;
  salary_max_value?: number | null;
  location_type?: string | null;
};

const base = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "base", company.slug).replace(/\/$/, "");

async function all(company: Company): Promise<Job[]> {
  const out: Job[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await getJson<{ jobs: { data: Job }[]; totalCount: number }>(`${base(company)}/api/jobs?page=${page}&limit=100`);
    out.push(...res.jobs.map((j) => j.data));
    if (out.length >= res.totalCount || res.jobs.length === 0) break;
  }
  return out;
}

const bodyText = (j: Job) => htmlToText([j.description, j.responsibilities, j.qualifications].filter(Boolean).join("\n\n"));

export const jibeDetail: DetailFetcher = async (company, job) => {
  const found = (await all(company)).find((j) => j.req_id === job.external_id);
  return found ? bodyText(found) || null : null;
};

export const jibe: Adapter = async (company, ctx) =>
  (await all(company))
    .filter((j) => !isEvergreen(j.title))
    .map((j): NormalizedJob => {
      // "Batam, Indonesia": the full country name avoids "ID"/"IN"/"DE" being read as US states
      // Viasat files its US-only remote roles ("Remote (excluding ND, VT, or RI)") under a placeholder country, so read the excluded US states
      const usRemote = /^Remote \(excluding (?:[A-Z]{2}(?:,? or |,? and |, )?)+\)/.test(j.city ?? "");
      const place = usRemote ? "United States" : [j.city, j.country_code ? countryName(j.country_code) : j.country].filter(Boolean).join(", ");
      const paid = j.salary_min_value || j.salary_max_value;
      return {
        external_id: j.req_id,
        title: (ctx.known.get(j.req_id) ?? j.title).trim(),
        location_raw: place || null,
        remote: j.location_type === "REMOTE" || /\bremote\b/i.test(j.title),
        department: j.categories?.[0]?.name ?? null,
        url: `${base(company)}/jobs/${j.slug ?? j.req_id}`,
        salary_min: paid ? (j.salary_min_value ?? null) : null,
        salary_max: paid ? (j.salary_max_value ?? null) : null,
        salary_currency: null,
        posted_at: j.posted_date ? new Date(j.posted_date).toISOString() : null,
        description: ctx.known.has(j.req_id) ? null : bodyText(j),
      };
    });

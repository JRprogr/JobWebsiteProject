import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getJson, isEvergreen } from "./http.ts";

type Job = {
  id: string;
  title: string;
  department?: string | null;
  team?: string | null;
  location?: string | null;
  secondaryLocations?: { location?: string | null }[];
  isListed?: boolean;
  workplaceType?: string | null;
  address?: { postalAddress?: { addressCountry?: string | null; addressLocality?: string | null } } | null;
  jobUrl: string;
  publishedAt?: string | null;
  descriptionPlain?: string | null;
  compensation?: {
    summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string; minValue?: number | null; maxValue?: number | null }[];
  } | null;
};

const api = (company: Pick<Company, "slug" | "source_config">) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(configString(company.source_config, "board", company.slug))}?includeCompensation=true`;

export const ashbyDetail: DetailFetcher = async (company, job) => {
  const { jobs } = await getJson<{ jobs: Job[] }>(api(company));
  return jobs.find((j) => j.id === job.external_id)?.descriptionPlain?.trim() || null;
};

export const ashby: Adapter = async (company, ctx) => {
  const { jobs } = await getJson<{ jobs: Job[] }>(api(company));
  const hint = defaultCountry(company.source_config);
  return jobs
    .filter((j) => j.isListed !== false && !isEvergreen(j.title))
    .map((j): NormalizedJob => {
      const postal = j.address?.postalAddress;
      const primary = postal?.addressLocality && postal.addressCountry ? `${postal.addressLocality}, ${postal.addressCountry}` : j.location;
      const places = [primary, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter((p): p is string => Boolean(p));
      const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary" && /year/i.test(c.interval ?? ""));
      return {
        external_id: j.id,
        title: j.title.trim(),
        location_raw: [...new Set(places)].join("; ") || null,
        remote: j.workplaceType === "Remote",
        department: j.department ?? j.team ?? null,
        url: j.jobUrl,
        salary_min: salary?.minValue ?? null,
        salary_max: salary?.maxValue ?? null,
        salary_currency: salary?.currencyCode ?? null,
        posted_at: j.publishedAt ? new Date(j.publishedAt).toISOString() : null,
        country_hint: hint,
        description: ctx.known.has(j.id) ? null : (j.descriptionPlain?.trim() ?? ""),
      };
    });
};

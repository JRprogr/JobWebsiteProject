import { mapPool, sleep } from "../pool.ts";
import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getJson, isEvergreen } from "./http.ts";

type ListItem = {
  id: string;
  jobOpeningName: string;
  departmentLabel?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
  isRemote?: boolean | null;
  locationType?: string | null;
};

type Detail = {
  description?: string | null;
  datePosted?: string | null;
  location?: { city?: string | null; state?: string | null; addressCountry?: string | null } | null;
};

const base = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "subdomain", company.slug)}.bamboohr.com/careers`;

async function fetchDetail(company: Company, id: string): Promise<Detail> {
  const { result } = await getJson<{ result: { jobOpening: Detail } }>(`${base(company)}/${encodeURIComponent(id)}/detail`, 30_000);
  return result.jobOpening;
}

export const bamboohrDetail: DetailFetcher = async (company, job) => {
  const d = await fetchDetail(company, job.external_id);
  return d.description ? htmlToText(d.description) || null : null;
};

// The list endpoint carries city/state but no country and no text; both come from the per-job detail call, which is limited per
// run like Workday's (a --backfill run does them all). Known jobs keep their stored country because the upsert preserves it.
export const bamboohr: Adapter = async (company, ctx) => {
  const listed = await getJson<{ result: ListItem[] }>(`${base(company)}/list`);
  const result = listed.result.filter((j) => !isEvergreen(j.jobOpeningName));
  const targets = result.filter((j) => !ctx.known.has(j.id)).slice(0, ctx.backfill ? 650 : 30);
  const details = new Map<string, Detail>();
  await mapPool(targets, 4, async (j) => {
    try {
      details.set(j.id, await fetchDetail(company, j.id));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(100);
  });

  return result.map((j): NormalizedJob => {
    const d = details.get(j.id);
    const city = d?.location?.city ?? j.location?.city;
    const region = d?.location?.state ?? j.location?.state;
    const raw = [city, d?.location?.addressCountry ?? region].filter(Boolean).join(", ");
    return {
      external_id: j.id,
      title: (ctx.known.get(j.id) ?? j.jobOpeningName).trim(),
      location_raw: raw || null,
      remote: j.isRemote === true || j.locationType === "1",
      department: j.departmentLabel && j.departmentLabel !== "None" ? j.departmentLabel : null,
      url: `${base(company)}/${j.id}`,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: d?.datePosted ? new Date(d.datePosted).toISOString() : null,
      description: d ? (d.description ? htmlToText(d.description) : "") : null,
    };
  });
};

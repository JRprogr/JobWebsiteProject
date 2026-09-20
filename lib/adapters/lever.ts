import type { Adapter, NormalizedJob } from "../types.ts";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string | null;
  workplaceType?: string | null;
  categories?: { location?: string; allLocations?: string[]; team?: string; department?: string };
  salaryRange?: { min?: number; max?: number; currency?: string } | null;
};

export const lever: Adapter = async (company) => {
  const site = company.source_config.site;
  if (typeof site !== "string") throw new Error(`${company.slug}: source_config.site missing`);
  const host = company.source_config.eu === true ? "api.eu.lever.co" : "api.lever.co";
  const url = `https://${host}/v0/postings/${encodeURIComponent(site)}?mode=json`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`lever ${res.status} for ${url}`);
  const postings = (await res.json()) as LeverPosting[];

  return postings.map((p): NormalizedJob => {
    const cats = p.categories ?? {};
    const all = cats.allLocations?.length ? cats.allLocations : cats.location ? [cats.location] : [];
    return {
      external_id: p.id,
      title: p.text.trim(),
      location_raw: all.length ? all.join("; ") : null,
      remote: p.workplaceType === "remote",
      department: cats.department ?? cats.team ?? null,
      url: p.hostedUrl,
      salary_min: p.salaryRange?.min ?? null,
      salary_max: p.salaryRange?.max ?? null,
      salary_currency: p.salaryRange?.currency ?? null,
      posted_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      country_hint: p.country ?? null,
    };
  });
};

import { politeFetch } from "./http.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string | null;
  workplaceType?: string | null;
  categories?: { location?: string; allLocations?: string[]; team?: string; department?: string };
  salaryRange?: { min?: number; max?: number; currency?: string } | null;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
};

function endpoint(company: { slug: string; source_config: Record<string, unknown> }): string {
  const site = company.source_config.site;
  if (typeof site !== "string") throw new Error(`${company.slug}: source_config.site missing`);
  const host = company.source_config.eu === true ? "api.eu.lever.co" : "api.lever.co";
  return `https://${host}/v0/postings/${encodeURIComponent(site)}`;
}

function bodyText(p: LeverPosting): string | null {
  const parts = [p.descriptionPlain, ...(p.lists ?? []).map((l) => `${l.text ?? ""}\n${htmlToText(l.content ?? "")}`), p.additionalPlain];
  const text = parts.filter((s): s is string => Boolean(s && s.trim())).join("\n\n").trim();
  return text || null;
}

export const leverDetail: DetailFetcher = async (company, job) => {
  const res = await politeFetch(`${endpoint(company)}/${encodeURIComponent(job.external_id)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`lever ${res.status} for posting ${job.external_id}`);
  return bodyText((await res.json()) as LeverPosting);
};

export const lever: Adapter = async (company, ctx) => {
  const url = `${endpoint(company)}?mode=json`;
  const res = await politeFetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`lever ${res.status} for ${url}`);
  const postings = (await res.json()) as LeverPosting[];

  return postings.map((p): NormalizedJob => {
    const cats = p.categories ?? {};
    const all = cats.allLocations?.length ? cats.allLocations : cats.location ? [cats.location] : [];
    return {
      external_id: p.id,
      title: decodeEntities(p.text).trim(),
      location_raw: all.length ? all.join("; ") : null,
      remote: p.workplaceType === "remote",
      department: cats.department ?? cats.team ?? null,
      url: p.hostedUrl,
      salary_min: p.salaryRange?.min ?? null,
      salary_max: p.salaryRange?.max ?? null,
      salary_currency: p.salaryRange?.currency ?? null,
      posted_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      country_hint: p.country ?? null,
      description: ctx.known.has(p.id) ? null : (bodyText(p) ?? ""),
    };
  });
};

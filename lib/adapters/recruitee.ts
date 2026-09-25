import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getJson, isEvergreen } from "./http.ts";

type Offer = {
  id: number;
  title: string;
  careers_url: string;
  department?: string | null;
  remote?: boolean;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  locations?: { city?: string | null; country?: string | null }[];
  published_at?: string | null;
  description?: string | null;
  requirements?: string | null;
  salary?: { min?: number | null; max?: number | null; period?: string | null; currency?: string | null } | null;
};

// Recruitee career sites (recruitee.com subdomain or a custom domain) expose their open offers at /api/offers/
const api = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "host", company.slug)}/api/offers`;

const bodyText = (o: Offer) => htmlToText([o.description, o.requirements].filter(Boolean).join("\n"));

export const recruiteeDetail: DetailFetcher = async (company, job) => {
  const { offer } = await getJson<{ offer: Offer }>(`${api(company)}/${encodeURIComponent(job.external_id)}`);
  return bodyText(offer) || null;
};

const isoDate = (s: string | null | undefined) => {
  const t = s ? Date.parse(s.replace(" UTC", "Z").replace(" ", "T")) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

export const recruitee: Adapter = async (company, ctx) => {
  const { offers } = await getJson<{ offers: Offer[] }>(`${api(company)}/`);
  const hint = defaultCountry(company.source_config);
  return offers.filter((o) => !isEvergreen(o.title)).map((o): NormalizedJob => {
    const places = (o.locations?.length ? o.locations : [{ city: o.city, country: o.country }])
      .map((l) => [l.city, l.country].filter(Boolean).join(", "))
      .filter(Boolean);
    const yearly = o.salary?.period === "year";
    const id = String(o.id);
    return {
      external_id: id,
      title: o.title.trim(),
      location_raw: [...new Set(places)].join("; ") || null,
      remote: Boolean(o.remote),
      department: o.department ?? null,
      url: o.careers_url,
      salary_min: yearly ? (o.salary?.min ?? null) : null,
      salary_max: yearly ? (o.salary?.max ?? null) : null,
      salary_currency: yearly ? (o.salary?.currency ?? null) : null,
      posted_at: isoDate(o.published_at),
      country_hint: o.country_code ?? hint,
      description: ctx.known.has(id) ? null : bodyText(o),
    };
  });
};

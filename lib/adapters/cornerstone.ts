import { countryName } from "../geo.ts";
import { htmlToText, stripCss } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getText, isEvergreen } from "./http.ts";

// Cornerstone OnDemand career sites (OHB, GMV): the careers page embeds a short-lived bearer token, which the site's own
// search service (<cloud>/rec-job-search/external/jobs) accepts; listing text comes back inline.
type Req = {
  requisitionId: number;
  displayJobTitle: string;
  postingEffectiveDate?: string;
  locations?: { city?: string | null; state?: string | null; country?: string | null }[];
  externalDescription?: string | null;
};

function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  return { host: configString(c, "host", company.slug), corp: configString(c, "corp", company.slug), site: typeof c.site === "number" ? c.site : 4 };
}

async function fetchAll(company: Company): Promise<Req[]> {
  const { host, corp, site } = cfg(company);
  const home = await getText(`https://${host}/ux/ats/careersite/${site}/home?c=${corp}&lang=en-US`);
  const token = /"token":"([^"]+)"/.exec(home)?.[1];
  const cloud = /"cloud":"([^"]+)"/.exec(home)?.[1];
  if (!token || !cloud) throw new Error(`${company.slug}: no token/cloud endpoint on the careers page`);

  const out: Req[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${cloud}rec-job-search/external/jobs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
        "csod-accept-language": "en-US",
        origin: `https://${host}`,
        "user-agent": "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)",
      },
      body: JSON.stringify({
        careerSiteId: site, careerSitePageId: site, pageNumber: page, pageSize: 100, cultureId: 1, searchText: "", cultureName: "en-US",
        states: [], countryCodes: [], cities: [], placeID: "", radius: null, postingsWithinDays: null,
        customFieldCheckboxKeys: [], customFieldDropdowns: [], customFieldRadios: [],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) throw new Error(`${res.status} from cornerstone search page ${page}`);
    const { data } = (await res.json()) as { data: { totalCount: number; requisitions: Req[] } };
    out.push(...data.requisitions);
    if (out.length >= data.totalCount || data.requisitions.length === 0) break;
  }
  return out;
}

const bodyText = (r: Req) => stripCss(htmlToText(r.externalDescription ?? "")).replace(/^Employment Opportunities\s*/i, "");

export const cornerstoneDetail: DetailFetcher = async (company, job) => {
  const found = (await fetchAll(company)).find((r) => String(r.requisitionId) === job.external_id);
  return found ? bodyText(found) || null : null;
};

// "10/9/2026" style dates are month-first in this feed
const parseDate = (s: string | undefined) => {
  const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))).toISOString() : null;
};

export const cornerstone: Adapter = async (company, ctx) => {
  const { host, corp, site } = cfg(company);
  return (await fetchAll(company))
    .filter((r) => !isEvergreen(r.displayJobTitle))
    .map((r): NormalizedJob => {
      const id = String(r.requisitionId);
      // country codes are ISO-2 but the location parser would read e.g. "DE"/"IN" as US states, so spell the country out
      const places = (r.locations ?? []).map((l) => {
        const country = l.country ? countryName(l.country) : null;
        return [l.city && l.city !== country ? l.city : null, country].filter(Boolean).join(", ");
      }).filter(Boolean);
      return {
        external_id: id,
        title: (ctx.known.get(id) ?? r.displayJobTitle).trim(),
        location_raw: [...new Set(places)].join("; ") || null,
        remote: false,
        department: null,
        url: `https://${host}/ux/ats/careersite/${site}/home/requisition/${id}?c=${corp}`,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        posted_at: parseDate(r.postingEffectiveDate),
        description: ctx.known.has(id) ? null : bodyText(r),
      };
    });
};

import { countryName } from "../geo.ts";
import { mapPool } from "../pool.ts";
import { htmlToText, stripCss } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getText, isEvergreen, USER_AGENT } from "./http.ts";

// Cornerstone OnDemand career sites (OHB, GMV): the careers page embeds a short-lived bearer token, which the site's own
// search service (<cloud>/rec-job-search/external/jobs) accepts. That search only returns the tasks part of a listing
// (externalDescription); the complete advertisement (tasks, profile, benefits) comes from the career site's own
// JobRequisitions service, which takes the same token.
type Req = {
  requisitionId: number;
  displayJobTitle: string;
  postingEffectiveDate?: string;
  locations?: { city?: string | null; state?: string | null; country?: string | null }[];
  externalDescription?: string | null;
};

type Session = { host: string; corp: string; site: number; token: string; cloud: string };

function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  return { host: configString(c, "host", company.slug), corp: configString(c, "corp", company.slug), site: typeof c.site === "number" ? c.site : 4 };
}

async function open(company: Pick<Company, "slug" | "source_config">): Promise<Session> {
  const { host, corp, site } = cfg(company);
  const home = await getText(`https://${host}/ux/ats/careersite/${site}/home?c=${corp}&lang=en-US`);
  const token = /"token":"([^"]+)"/.exec(home)?.[1];
  const cloud = /"cloud":"([^"]+)"/.exec(home)?.[1];
  if (!token || !cloud) throw new Error(`${company.slug}: no token/cloud endpoint on the careers page`);
  return { host, corp, site, token, cloud };
}

async function search(s: Session): Promise<Req[]> {
  const out: Req[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${s.cloud}rec-job-search/external/jobs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${s.token}`,
        "content-type": "application/json",
        accept: "application/json",
        "csod-accept-language": "en-US",
        origin: `https://${s.host}`,
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({
        careerSiteId: s.site, careerSitePageId: s.site, pageNumber: page, pageSize: 100, cultureId: 1, searchText: "", cultureName: "en-US",
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

const clean = (html: string) => stripCss(htmlToText(html.replace(/<style[\s\S]*?<\/style>/gi, ""))).replace(/^Employment Opportunities\s*/i, "");

const shortText = (r: Req) => clean(r.externalDescription ?? "");

// The complete advertisement of one requisition, or null when the service has none
async function fullText(s: Session, id: string | number): Promise<string | null> {
  const res = await fetch(`https://${s.host}/Services/API/ATS/CareerSite/${s.site}/JobRequisitions/${id}?useMobileAd=false&cultureId=2`, {
    headers: { authorization: `Bearer ${s.token}`, accept: "application/json", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { items?: { fields?: { ad?: string } }[] }[] };
  const ad = json.data?.[0]?.items?.[0]?.fields?.ad;
  return ad ? clean(ad) || null : null;
}

export const cornerstoneDetail: DetailFetcher = async (company, job) => {
  const s = await open(company);
  return (await fullText(s, job.external_id)) ?? shortText((await search(s)).find((r) => String(r.requisitionId) === job.external_id) ?? { requisitionId: 0, displayJobTitle: "" });
};

// "10/9/2026" style dates are month-first in this feed
const parseDate = (s: string | undefined) => {
  const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))).toISOString() : null;
};

// OHB keeps a template requisition ("insert title of the position (m/f/d)") in its feed
const isTemplate = (title: string) => /^insert title|^please fill in/i.test(title.trim());

export const cornerstone: Adapter = async (company, ctx) => {
  const { host, corp, site } = cfg(company);
  const s = await open(company);
  const reqs = (await search(s)).filter((r) => !isEvergreen(r.displayJobTitle) && !isTemplate(r.displayJobTitle));

  // like the other detail-gated adapters: full advertisements for 30 new listings per cron run (more with --backfill); the rest wait
  const targets = reqs.filter((r) => !ctx.known.has(String(r.requisitionId))).slice(0, ctx.backfill ? 400 : 30);
  const texts = new Map<string, string>();
  await mapPool(targets, 4, async (r) => {
    try {
      texts.set(String(r.requisitionId), (await fullText(s, r.requisitionId)) ?? shortText(r));
    } catch {
      // left unprocessed; retried on the next run
    }
  });

  return reqs.map((r): NormalizedJob => {
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
      description: texts.get(id) ?? null,
    };
  });
};

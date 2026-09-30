import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getJson, getText, isEvergreen } from "./http.ts";

// Liebherr Group's own job-listing platform (liebherr.com/.../careers/job-vacancies-...). One shared, worldwide listing
// across all 13 Liebherr divisions and every "Liebherr-<X>" legal entity; source_config narrows it down:
//   division_id     the "Division" facet id for the wanted division (Aerospace and transportation systems = 2248246747),
//                   found from the site's own filter links (<a href="...?filter=<id>;...">). The division bundles
//                   aerospace parts AND rail/transportation systems under one facet, so...
//   company_prefix  ...jobs are additionally kept only when their `company.name` starts with this (e.g.
//                   "Liebherr-Aerospace"), which drops the Liebherr-Transportation-Systems entities sharing the division.
//   detail_page_id  the numeric suffix every job detail URL on this locale ends with (from a sample job's own
//                   jobDetailPageUrl, e.g. ".../84623-de-4294646" -> "4294646"); the internal list API needs it too.
// The internal list API pages at a fixed 10 results regardless of the page size asked for once the page index is
// anything but 1 (an undocumented quirk, reproduced against the real site), so paging always asks for 10.
const BASE = "https://www.liebherr.com";
const PAGE_SIZE = 10;
const MAX_PAGES = 60;

type Cfg = { divisionId: string; companyPrefix: string; detailPageId: string };

function cfg(company: Pick<Company, "slug" | "source_config">): Cfg {
  const c = company.source_config;
  return {
    divisionId: configString(c, "division_id", company.slug),
    companyPrefix: configString(c, "company_prefix", company.slug),
    detailPageId: configString(c, "detail_page_id", company.slug),
  };
}

type ListJob = { jobId: string; jobDetailPageUrl: string; title: string; city?: { label?: string }; company?: { name?: string }; workArea?: { label?: string } };
type ListResponse = { jobs: ListJob[]; total: number };

type Row = { id: string; url: string; title: string; city: string | null; department: string | null };

async function listAll(k: Cfg): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}/_api/app/job/list_page/en-us/${page}/${PAGE_SIZE}?detailPageId=${k.detailPageId}&filter=${k.divisionId}&term=&jobcountry=`;
    const json = await getJson<ListResponse>(url);
    if (json.jobs.length === 0) break;
    for (const j of json.jobs) {
      // one entity spells it "Liebherr Aerospace Brasil Ltda." (no hyphen) unlike the rest ("Liebherr-Aerospace ..."),
      // so the hyphen is normalized to a space on both sides before comparing
      const name = (j.company?.name ?? "").replace("-", " ");
      if (!name.startsWith(k.companyPrefix.replace("-", " "))) continue;
      if (isEvergreen(j.title)) continue;
      rows.push({ id: j.jobId, url: `${BASE}${j.jobDetailPageUrl}`, title: decodeEntities(j.title), city: j.city?.label ?? null, department: j.workArea?.label ?? null });
    }
    if (json.jobs.length < PAGE_SIZE) break;
    await sleep(80);
  }
  return rows;
}

// The raw text of a job's own "Country" field is in whichever language that posting was authored in, not the site's
// browsing locale; only the languages actually seen across this division's countries are mapped.
const COUNTRY_LABELS: Record<string, string> = { deutschland: "DE", germany: "DE", france: "FR", frankreich: "FR", brasil: "BR", brazil: "BR", österreich: "AT", austria: "AT" };

async function detail(url: string): Promise<{ text: string | null; country: string | null }> {
  const html = await getText(url);
  const countryRaw = /data-testid="jdp-infobox-detail-country">([^<]+)</.exec(html)?.[1];
  const country = countryRaw ? (COUNTRY_LABELS[countryRaw.trim().toLowerCase()] ?? null) : null;
  const el = extractElement(html, 'data-testid="jdp-section"');
  const text = el ? htmlToText(el.replace(/<(script|style|nav|header|footer)\b[\s\S]*?<\/\1>/gi, "")) : null;
  return { text, country };
}

export const liebherrDetail: DetailFetcher = async (_company, job) => (await detail(job.url)).text;

export const liebherr: Adapter = async (company, ctx) => {
  const k = cfg(company);
  const hint = defaultCountry(company.source_config);
  const rows = await listAll(k);

  const targets = rows.filter((r) => !ctx.known.has(r.id)).slice(0, ctx.backfill ? 300 : 30);
  const details = new Map<string, { text: string | null; country: string | null }>();
  await mapPool(targets, 3, async (r) => {
    try {
      details.set(r.id, await detail(r.url));
    } catch {
      // left unprocessed, retried on a later run
    }
    await sleep(100);
  });

  return rows.map((r): NormalizedJob => {
    const d = details.get(r.id);
    return {
      external_id: r.id,
      title: (ctx.known.get(r.id) ?? r.title).trim(),
      location_raw: r.city,
      remote: false,
      department: r.department,
      url: r.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
      country_hint: d?.country ?? hint,
      description: ctx.known.has(r.id) ? null : d ? (d.text ?? "") : undefined,
    };
  });
};

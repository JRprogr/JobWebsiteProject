import { mapPool, sleep } from "../pool.ts";
import { decodeEntities } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen, isoPlace } from "./http.ts";
import { parseDlrPage } from "./custom.ts";

// SAP SuccessFactors "career site builder" portals (ESA, SES, Beyond Gravity). Search results are plain server-rendered HTML
// at <base><prefix>/search/?q=&startrow=N in one of two layouts (table rows or tiles); listing text comes from each job page.
type Cfg = { base: string; prefix: string };

function cfg(company: Pick<Company, "slug" | "source_config">): Cfg {
  const prefix = typeof company.source_config.prefix === "string" ? company.source_config.prefix : "";
  return { base: configString(company.source_config, "base", company.slug).replace(/\/$/, ""), prefix };
}

type Row = { id: string; href: string; title: string; location: string | null; date: string | null };

const clean = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// Splits a results page into one chunk per job (from its first title link to the next job's), then reads title, location and date
export function parseSearchPage(html: string): Row[] {
  const link = /<a[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*href="([^"]*\/job\/[^"]*\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>|<a[^>]*href="([^"]*\/job\/[^"]*\/(\d+)\/?)"[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const starts: { id: string; href: string; title: string; at: number }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(link)) {
    const id = m[2] ?? m[5];
    if (seen.has(id)) continue;
    seen.add(id);
    starts.push({ id, href: decodeEntities(m[1] ?? m[4]), title: clean(m[3] ?? m[6]), at: m.index });
  }
  return starts.map((s, i) => {
    const chunk = html.slice(s.at, starts[i + 1]?.at ?? html.length);
    const loc =
      /class="jobLocation"[^>]*>([\s\S]*?)<\/span>/.exec(chunk)?.[1] ??
      new RegExp(`job-${s.id}-desktop-section-(?:multilocation|location|facility)-value"[^>]*>([\\s\\S]*?)</div>`).exec(chunk)?.[1];
    const date = /class="jobDate"[^>]*>([\s\S]*?)<\/span>/.exec(chunk)?.[1];
    // Tiles print a hidden field label first ("Workplace Noordwijk, NL") and truncate long lists ("Betzdorf, LU +1 more…")
    const place = loc ? clean(loc).replace(/^(?:Workplace|Other Locations|Locations?|Facility)\s+/i, "").replace(/\s*\+\d+ more.*$/i, "") : "";
    return { id: s.id, href: s.href, title: s.title, location: place || null, date: date ? clean(date) : null };
  });
}

async function listAll(company: Company): Promise<Row[]> {
  const { base, prefix } = cfg(company);
  const all = new Map<string, Row>();
  let startrow = 0;
  for (let page = 0; page < 60; page++) {
    const html = await getText(`${base}${prefix}/search/?q=&startrow=${startrow}`);
    const rows = parseSearchPage(html);
    const fresh = rows.filter((r) => !all.has(r.id));
    for (const r of fresh) all.set(r.id, r);
    if (fresh.length === 0) break;
    startrow += rows.length;
    await sleep(100);
  }
  return [...all.values()];
}

const urlOf = (company: Company, href: string) => (href.startsWith("http") ? href : `${cfg(company).base}${href}`);

// "Betzdorf-Senior-Engineer" -> "Betzdorf": every listing URL starts with its city, which is the only location some layouts show
const cityFromHref = (href: string) => decodeURIComponent(href.split("/job/")[1]?.split("/")[0] ?? "").split("-")[0] || null;

const parseDate = (s: string | null) => {
  const t = s ? Date.parse(s.replace("Sept", "Sep")) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

// Every job page opens with the apply-button strip ("Apply now » Apply now • Start apply with LinkedIn • … Please wait...")
const tidy = (text: string | null) => text?.replace(/^(?:(?:Apply now »|Apply now|Start apply with LinkedIn|Start|•|Please wait\.\.\.)\s*)+/i, "") || null;

export const successfactorsDetail: DetailFetcher = async (_company, job) => tidy(parseDlrPage(await getText(job.url)).text);

export const successfactors: Adapter = async (company, ctx) => {
  const rows = (await listAll(company)).filter((r) => !isEvergreen(r.title));
  const hint = defaultCountry(company.source_config);

  const targets = rows.filter((r) => !ctx.known.has(r.id)).slice(0, ctx.backfill ? 400 : 30);
  const pages = new Map<string, string | null>();
  await mapPool(targets, 3, async (r) => {
    try {
      pages.set(r.id, tidy(parseDlrPage(await getText(urlOf(company, r.href))).text));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return rows.map((r): NormalizedJob => {
    const page = pages.get(r.id);
    const where = isoPlace(r.location ?? cityFromHref(r.href));
    return {
      external_id: r.id,
      title: (ctx.known.get(r.id) ?? r.title).trim(),
      location_raw: where.place,
      remote: false,
      department: null,
      url: urlOf(company, r.href),
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: parseDate(r.date),
      country_hint: where.country ?? hint,
      description: page !== undefined ? (page ?? "") : null,
    };
  });
};


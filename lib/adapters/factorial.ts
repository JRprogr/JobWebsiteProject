import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Factorial career sites (<host> = <name>.factorialhr.com / .factorial.it / .factorialhr.pt): the start page lists every open
// job server-side (title, contract, remote flag and location/team ids in data attributes); the job page has the text.
const root = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "host", company.slug)}`;

type Item = { id: string; url: string; title: string; locationId: string | null; remote: boolean };

const attr = (tag: string, name: string) => new RegExp(`${name}='([^']*)'`).exec(tag)?.[1] ?? null;

function options(html: string, selectId: string): Map<string, string> {
  const select = new RegExp(`<select[^>]*id='${selectId}'[\\s\\S]*?</select>`).exec(html)?.[0] ?? "";
  return new Map([...select.matchAll(/<option[^>]*value='(\d+)'[^>]*>([^<]*)</g)].map((m) => [m[1], decodeEntities(m[2]).trim()]));
}

export function parseList(html: string): { items: Item[]; locations: Map<string, string> } {
  const items: Item[] = [];
  for (const m of html.matchAll(/<[a-z]+[^>]*data-job-postings-url='[^']+'[^>]*>/g)) {
    const url = attr(m[0], "data-job-postings-url");
    const id = url?.match(/-(\d+)$/)?.[1];
    if (!url || !id) continue;
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 1500);
    const title = /factorial__headingFontFamily[^>]*>([^<]*)</.exec(after)?.[1];
    if (!title) continue;
    items.push({ id, url, title: decodeEntities(title).trim(), locationId: attr(m[0], "data-location-id"), remote: attr(m[0], "data-is-remote") === "true" });
  }
  return { items, locations: options(html, "location_filter") };
}

// The job page repeats contract/salary/location as small chips; the location chip is the one shaped like "City, Country"
export function parseJobPage(html: string): { text: string | null; location: string | null } {
  const body = extractElement(html, "class='styledText'");
  const chips = [...html.matchAll(/<span class='inline-block align-middle mr-2 ml-2'>([^<]+)<\/span>/g)].map((m) => decodeEntities(m[1]).trim());
  // remote/hybrid chips wrap the place in brackets: "Hybrid (Fino Mornasco, Italy)"
  const places = chips.map((c) => /\(([^()]+,[^()]+)\)/.exec(c)?.[1]?.trim() ?? c.replace(/\s+/g, " "));
  return { text: body ? htmlToText(body) : null, location: places.find((c) => /^[^\d€$£]+,\s*[^\d€$£]+$/.test(c)) ?? null };
}

export const factorialDetail: DetailFetcher = async (_company, job) => parseJobPage(await getText(job.url)).text;

export const factorial: Adapter = async (company, ctx) => {
  const { items: all, locations } = parseList(await getText(`${root(company)}/`));
  const items = all.filter((i) => !isEvergreen(i.title));
  const hint = defaultCountry(company.source_config);

  const targets = items.filter((i) => !ctx.known.has(i.id)).slice(0, ctx.backfill ? 400 : 30);
  const pages = new Map<string, ReturnType<typeof parseJobPage>>();
  await mapPool(targets, 3, async (i) => {
    try {
      pages.set(i.id, parseJobPage(await getText(i.url)));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return items.map((i): NormalizedJob => {
    const page = pages.get(i.id);
    return {
      external_id: i.id,
      title: (ctx.known.get(i.id) ?? i.title).trim(),
      location_raw: page?.location ?? (i.locationId ? (locations.get(i.locationId) ?? null) : null),
      remote: i.remote,
      department: null,
      url: i.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
      country_hint: hint,
      description: page ? (page.text ?? "") : null,
    };
  });
};

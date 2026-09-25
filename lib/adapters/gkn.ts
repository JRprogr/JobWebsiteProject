import { htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";
import { isEvergreen } from "./http.ts";

// GKN Aerospace's own careers front end (joinus.gknaerospace.com) is a JS app over a JSON API: POST /api/jobs pages through every
// open job with its full description, location list and country code. It is used as the custom kind "gkn-api".
const API = "https://joinus.gknaerospace.com/api/jobs";

type Item = {
  id: string;
  title: string;
  description?: string | null;
  team?: string | null;
  location?: string | null;
  multiLocation?: string[] | null;
  countryCode?: string | null;
  datePosted?: string | null;
  url: string;
};
type Page = { items: Item[]; hasNextPage: boolean };

async function page(pageNumber: number): Promise<Page> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)" },
    body: JSON.stringify({ searchQuery: "", location: "", team: "", startDate: null, endDate: null, pageNumber, pageSize: 50 }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`${res.status} for gkn jobs page ${pageNumber}`);
  return (await res.json()) as Page;
}

async function all(): Promise<Item[]> {
  const items: Item[] = [];
  for (let n = 1; n <= 20; n++) {
    const p = await page(n);
    items.push(...p.items);
    if (!p.hasNextPage) break;
  }
  return items;
}

export const gknDetail: DetailFetcher = async (_company, job) => {
  // the API has no single-job endpoint, so the detail lookup scans the full listing
  const found = (await all()).find((i) => i.id === job.external_id);
  return found?.description ? htmlToText(found.description) || null : null;
};

// "Chennai, IN": the trailing country code is dropped from the place and handed over as country_hint instead, because the
// location parser would read IN (and AL, DE, ...) as a US state
function places(i: Item): string | null {
  const list = i.multiLocation?.length ? i.multiLocation : i.location ? [i.location] : [];
  const suffix = i.countryCode ? `, ${i.countryCode}` : null;
  return list.map((l) => (suffix && l.endsWith(suffix) ? l.slice(0, -suffix.length) : l)).join("; ") || null;
}

export const gkn: Adapter = async (_company, ctx) =>
  (await all())
    .filter((i) => !isEvergreen(i.title))
    .map((i): NormalizedJob => ({
      external_id: i.id,
      title: i.title.trim(),
      location_raw: places(i),
      remote: false,
      department: i.team ?? null,
      url: i.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: i.datePosted ? new Date(`${i.datePosted}Z`).toISOString() : null,
      country_hint: i.countryCode ?? null,
      description: ctx.known.has(i.id) ? null : i.description ? htmlToText(i.description) : "",
    }));

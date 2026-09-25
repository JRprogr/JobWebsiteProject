import { mapPool, sleep } from "../pool.ts";
import { decodeEntities } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { getText } from "./http.ts";

// Safran's own job search (safran-group.com/jobs, used as the custom kind "safran-web"): 12 offers per page, filtered to the entities in
// source_config.companies (the space and defence ones; the group as a whole lists ~4,000 offers, mostly civil aero engines and cabins).
// The list pages carry everything shown here, while every offer page sits behind a Cloudflare challenge, so there is no listing text:
// experience comes from the title alone, and the "Full listing" link goes to Safran's own page.
type Offer = { id: string; url: string; title: string; posted: string | null; unit: string | null; location: string | null; contract: string | null; field: string | null };

const ROOT = "https://www.safran-group.com/jobs";
const text = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const query = (company: Pick<Company, "source_config">, page: number) => {
  const ids = Array.isArray(company.source_config.companies) ? (company.source_config.companies as string[]) : [];
  return `${ROOT}?${[...ids.map((id) => `companies%5B%5D=${id}`), ...(page > 0 ? [`page=${page}`] : [])].join("&")}`;
};

export function parseOffers(html: string): Offer[] {
  return html
    .split('class="c-offer-item js-block-link"')
    .slice(1)
    .flatMap((chunk): Offer[] => {
      const link = /<a href="(https:\/\/www\.safran-group\.com\/jobs\/[^"]+-(\d+))"[^>]*class="c-offer-item__title[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(chunk);
      if (!link) return [];
      const info: Record<string, string> = {};
      for (const m of chunk.matchAll(/icon-(hierarchy|location|status|file1|tags)[^"]*"[^>]*>(?:<use[^>]*><\/use><\/svg>|<\/span>)\s*([^<]+)/g)) info[m[1]] = text(m[2]);
      const date = /c-offer-item__date">(\d{2})\.(\d{2})\.(\d{4})</.exec(chunk);
      return [
        {
          id: link[2],
          url: link[1],
          title: text(link[3]),
          posted: date ? new Date(Date.UTC(Number(date[3]), Number(date[1]) - 1, Number(date[2]))).toISOString() : null,
          unit: info.hierarchy ?? null,
          location: info.location ?? null,
          contract: info.file1 ?? null,
          field: info.tags ?? null,
        },
      ];
    });
}

export const safranDetail: DetailFetcher = async () => null;

export const safran: Adapter = async (company, ctx) => {
  const first = await getText(query(company, 0));
  const last = Number(/page=(\d+)"\s*title="Go to last page/.exec(first)?.[1] ?? 0);
  const all = new Map(parseOffers(first).map((o) => [o.id, o]));
  const pages = Array.from({ length: Math.min(last, 150) }, (_, i) => i + 1);
  await mapPool(pages, 5, async (page) => {
    // a failing page fails the whole run on purpose: a partial list would mark every offer on the missing pages as removed
    for (const o of parseOffers(await getText(query(company, page)))) all.set(o.id, o);
    await sleep(100);
  });

  return [...all.values()].map((o): NormalizedJob => ({
    external_id: o.id,
    title: (ctx.known.get(o.id) ?? o.title).trim(),
    location_raw: o.location,
    remote: false,
    department: o.field ?? o.unit,
    url: o.url,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: o.posted,
    // no text to read: an empty description marks the offer as processed so the title-based experience estimate applies
    description: ctx.known.has(o.id) ? null : "",
  }));
};

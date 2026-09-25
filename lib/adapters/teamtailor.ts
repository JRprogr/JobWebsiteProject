import { htmlToText } from "../text.ts";
import { blocks, tagText } from "../xml.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Teamtailor career sites (teamtailor.com subdomain or a custom domain) all serve an RSS feed of open jobs at /jobs.rss
const feed = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "host", company.slug)}/jobs.rss`;

// The numeric id in the job URL ("/jobs/8434380-structural-engineer") is stable; the guid is a fallback
const idOf = (item: string) => tagText(item, "link")?.match(/\/jobs\/(\d+)/)?.[1] ?? tagText(item, "guid");

export const teamtailorDetail: DetailFetcher = async (company, job) => {
  const item = blocks(await getText(feed(company)), "item").find((i) => idOf(i) === job.external_id);
  const html = item ? tagText(item, "description") : null;
  return html ? htmlToText(html) : null;
};

export const teamtailor: Adapter = async (company, ctx) => {
  const hint = defaultCountry(company.source_config);
  return blocks(await getText(feed(company)), "item").flatMap((item): NormalizedJob[] => {
    const id = idOf(item);
    const title = tagText(item, "title");
    const url = tagText(item, "link");
    if (!id || !title || !url || isEvergreen(title)) return [];
    const places = blocks(item, "tt:location")
      .map((l) => [tagText(l, "tt:city") ?? tagText(l, "tt:name"), tagText(l, "tt:country")].filter(Boolean).join(", "))
      .filter(Boolean);
    const posted = tagText(item, "pubDate");
    const html = tagText(item, "description");
    return [
      {
        external_id: id,
        title,
        location_raw: [...new Set(places)].join("; ") || null,
        remote: tagText(item, "remoteStatus") === "fully",
        department: tagText(item, "tt:department"),
        url,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        posted_at: posted && !Number.isNaN(Date.parse(posted)) ? new Date(posted).toISOString() : null,
        country_hint: hint,
        description: ctx.known.has(id) ? null : html ? htmlToText(html) : "",
      },
    ];
  });
};

import { extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// Clarity Loop (hr.clarityloop.com) recruitment boards, used by AAC Clyde Space: `list_url` is the embedded open-recruitments page
// (its own careers page loads it), one card per job with title and location chip; the application-form page has the full text.
const listUrl = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "list_url", company.slug);

export function parseCards(html: string, origin: string): Row[] {
  return html
    .split("oh-joblist_card__title-link")
    .slice(1)
    .flatMap((chunk): Row[] => {
      const link = /href='?"?\/recruitment\/recruitment-details\/([a-z0-9-]+)\/(\d+)\/[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
      if (!link) return [];
      // "Glasgow (Scotland, UK)" -> "Glasgow, UK": keep the city and the country, which is the last part of the parentheses
      const chips = [...chunk.matchAll(/oh-recuritment_tag[^>]*>([\s\S]*?)<\/div>/g)]
        .map((m) => strip(m[1]).replace(/^(.*?)\s*\((?:[^()]*,\s*)?([^(),]+)\)$/, "$1, $2"))
        .filter(Boolean);
      // "Test Engineer (Glasgow, UK)": the location chip carries the same information
      const title = strip(link[3]);
      return [{ id: link[2], url: `${origin}/recruitment/application-form/${link[1]}/?recruitmentId=${link[2]}`, title: chips.length ? title.replace(/\s*\([^()]*,[^()]*\)$/, "") : title, location: chips.join("; ") || null }];
    })
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
}

async function fetchText(url: string): Promise<string | null> {
  const body = extractElement(await getText(url), 'id="recruitmentInfoBody"');
  return body ? htmlToText(body) || null : null;
}

export const clarityloopDetail: DetailFetcher = async (_company, job) => fetchText(job.url);

export const clarityloop: Adapter = async (company, ctx) => {
  const url = listUrl(company);
  return runBoard(company, ctx, parseCards(await getText(url), new URL(url).origin), (r) => fetchText(r.url));
};

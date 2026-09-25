import { extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// PeopleForce career sites (<subdomain>.peopleforce.io/careers): server-rendered cards, paged with ?page=N. Cards carry the
// team but no location (the board's own country goes in source_config.default_country); listing text sits in the "fr-view" block.
const root = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "subdomain", company.slug)}.peopleforce.io`;

export function parseCards(html: string): Row[] {
  const anchors = [...html.matchAll(/<a[^>]*href="(\/careers\/v\/(\d+)-[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
  return anchors.map((m, i): Row => {
    const window = html.slice(m.index, anchors[i + 1]?.index ?? m.index + 1500);
    const team = /fa-briefcase[^>]*><\/i>([^<]*)/.exec(window)?.[1];
    return {
      id: m[2],
      url: m[1],
      title: strip(m[3]),
      location: null,
      // "Electronics [team]" / "R&D [dział]": the suffix marks the hierarchy level and is noise here
      department: team ? strip(team).replace(/\s*\[[^\]]*\]$/, "") || null : null,
    };
  });
}

async function fetchText(url: string): Promise<string | null> {
  const body = extractElement(await getText(url), 'class="fr-view"');
  return body ? htmlToText(body) || null : null;
}

export const peopleforceDetail: DetailFetcher = async (company, job) => fetchText(job.url.startsWith("http") ? job.url : `${root(company)}${job.url}`);

export const peopleforce: Adapter = async (company, ctx) => {
  const all: Row[] = [];
  for (let page = 1; page <= 15; page++) {
    const rows = parseCards(await getText(`${root(company)}/careers?page=${page}`));
    if (rows.every((r) => all.some((a) => a.id === r.id))) break;
    all.push(...rows);
  }
  const rows = all.map((r) => ({ ...r, url: `${root(company)}${r.url}` }));
  return runBoard(company, ctx, rows, (r) => fetchText(r.url));
};

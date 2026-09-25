import { extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// HR-ON (Danish recruitment system, used by GomSpace): <subdomain>.hr-on.com lists every open position with its place of work,
// and /show-job/<id> has the listing text in the "description" block.
const root = (company: Pick<Company, "slug" | "source_config">) => `https://${configString(company.source_config, "subdomain", company.slug)}.hr-on.com`;

// source_config.place_countries maps a place of work to its ISO code when it is outside the board's default country ("Esch-sur-Alzette": "LU")
export function parseList(html: string, host: string, placeCountries: Record<string, string> = {}): Row[] {
  return html
    .split('class="jobposting"')
    .slice(1)
    .flatMap((chunk): Row[] => {
      const id = /hr-on\.com\/show-job\/(\d+)/.exec(chunk)?.[1] ?? /show-job\/(\d+)/.exec(chunk)?.[1];
      const title = /<h2>([\s\S]*?)<\/h2>/.exec(chunk)?.[1];
      if (!id || !title) return [];
      const place = /Place of work:\s*<strong>([\s\S]*?)<\/strong>/.exec(chunk)?.[1];
      const where = place ? strip(place) || null : null;
      return [{ id, url: `${host}/show-job/${id}&locale=en_US`, title: strip(title), location: where, country: (where && placeCountries[where]) || null }];
    });
}

async function fetchText(url: string): Promise<string | null> {
  const body = extractElement(await getText(url), 'class="description"');
  return body ? htmlToText(body) || null : null;
}

export const hronDetail: DetailFetcher = async (_company, job) => fetchText(job.url);

export const hron: Adapter = async (company, ctx) => {
  const host = root(company);
  const placeCountries = company.source_config.place_countries as Record<string, string> | undefined;
  return runBoard(company, ctx, parseList(await getText(`${host}/`), host, placeCountries), (r) => fetchText(r.url));
};

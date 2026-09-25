import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Skeeled (Luxembourg ATS). Two ways to find a company's open offers, chosen by source_config:
//   board_id     -> the public board page https://app.skeeled.com/board/<board_id> (server-rendered offer cards)
//   listing_url  -> the employer's own careers page, whose offer cards link to skeeled.com (LIST)
// Every offer lives at https://app.skeeled.com/offer/c/<24-hex id>, which is also where the listing text comes from.
type Offer = { id: string; url: string; title: string; location: string | null };

const text = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// Board page: <a href=".../offer/c/<id>?..." class="v-card ..."><div class="v-card-title">Title</div>...<span>contract</span>...<span>City</span><span> - </span><span>Country</span></a>
export function parseBoard(html: string): Offer[] {
  return [...html.matchAll(/<a href="(https:\/\/app\.skeeled\.com\/offer\/c\/([0-9a-f]{24})[^"]*)" class="v-card[\s\S]*?<\/a>/g)].flatMap((m) => {
    const title = /class="v-card-title[^>]*>([^<]*)</.exec(m[0])?.[1];
    if (!title) return [];
    // the contract type sits in its own "text-truncate" block (missing on some offers); what remains is "City - Country"
    const place = m[0].replace(/<div class="text-truncate"[\s\S]*?<\/div>/, "");
    const spans = [...place.matchAll(/<span(?![^>]*v-card__)[^>]*>([^<]*)<\/span>/g)].map((s) => decodeEntities(s[1])).filter((s) => s.trim());
    return [{ id: m[2], url: decodeEntities(m[1]), title: text(title), location: spans.join("").replace(/\s+/g, " ").trim() || null }];
  });
}

// LIST's careers page: <div class="lt-job-card"> location <p>, title <p ... weight--600>, contract, and the skeeled link
export function parseCards(html: string): Offer[] {
  return html
    .split('class="lt-job-card"')
    .slice(1)
    .flatMap((chunk) => {
      const link = /href="(https:\/\/app\.skeeled\.com\/offer\/c\/([0-9a-f]{24})[^"]*)"/.exec(chunk);
      const title = /weight--600[^>]*>([\s\S]*?)<\/p>/.exec(chunk)?.[1];
      if (!link || !title) return [];
      const location = /lt-job-card__location[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/.exec(chunk)?.[1];
      return [{ id: link[2], url: decodeEntities(link[1]), title: text(title), location: location ? text(location) || null : null }];
    });
}

async function offers(company: Pick<Company, "slug" | "source_config">): Promise<Offer[]> {
  const c = company.source_config;
  if (typeof c.board_id === "string") return parseBoard(await getText(`https://app.skeeled.com/board/${c.board_id}`));
  return parseCards(await getText(configString(c, "listing_url", company.slug)));
}

const offerPage = (id: string) => `https://app.skeeled.com/offer/c/${id}?lang=en&show_description=true`;

async function fetchText(id: string): Promise<string | null> {
  const body = extractElement(await getText(offerPage(id)), 'class="offer-description text-break"');
  return body ? htmlToText(body) || null : null;
}

export const skeeledDetail: DetailFetcher = async (_company, job) => fetchText(job.external_id);

export const skeeled: Adapter = async (company, ctx) => {
  const list = (await offers(company)).filter((o) => !isEvergreen(o.title));
  const hint = defaultCountry(company.source_config);

  const targets = list.filter((o) => !ctx.known.has(o.id)).slice(0, ctx.backfill ? 300 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (o) => {
    try {
      texts.set(o.id, await fetchText(o.id));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(150);
  });

  return list.map((o): NormalizedJob => ({
    external_id: o.id,
    title: (ctx.known.get(o.id) ?? o.title).trim(),
    location_raw: o.location,
    remote: false,
    department: null,
    url: o.url,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: null,
    country_hint: hint,
    description: texts.has(o.id) ? (texts.get(o.id) ?? "") : null,
  }));
};

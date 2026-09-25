import { mapPool } from "../pool.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import { blocks, tagText } from "../xml.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Talentsoft career sites (Dassault Aviation). Every filter has its own RSS feed (offerRss.ashx?...&Rss_<Filter>=<id>) and a feed
// returns at most 20 offers with the full text, so all offers are collected by taking the union over the family / contract / region /
// country / education feeds listed on <base>/offre-de-emploi/tous-les-flux-rss.aspx. Each item's categories are
// [family, contract, city].
const FILTERS = ["Rss_JobFamily", "Rss_Contract", "Rss_JobRegion", "Rss_JobCountry", "Rss_EducationLevel"];

const base = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "base", company.slug).replace(/\/$/, "");

type Offer = { id: string; title: string; url: string; city: string | null; department: string | null; html: string; posted: string | null };

function parseFeed(xml: string): Offer[] {
  return blocks(xml, "item").flatMap((item): Offer[] => {
    const url = tagText(item, "link");
    const id = url?.match(/idOffre=(\d+)/)?.[1];
    const title = tagText(item, "title");
    if (!url || !id || !title) return [];
    const cats = blocks(item, "category").map((c) => decodeEntities(c).trim());
    const posted = tagText(item, "pubDate");
    return [
      {
        id,
        // "2026-15690 - Acheteur Pièces Primaires F/H": the reference number leads the title
        title: title.replace(/^\d{4}-\d+\s*-\s*/, ""),
        url,
        city: cats[2] ?? null,
        department: cats[0] ?? null,
        html: tagText(item, "description") ?? "",
        posted: posted && !Number.isNaN(Date.parse(posted)) ? new Date(posted).toISOString() : null,
      },
    ];
  });
}

async function offers(company: Company): Promise<Offer[]> {
  const root = base(company);
  const index = await getText(`${root}/offre-de-emploi/tous-les-flux-rss.aspx`);
  const feeds = [
    ...new Set([...index.matchAll(/href="(\/handlers\/offerRss\.ashx\?[^"]*)"/g)].map((m) => decodeEntities(m[1]))),
  ].filter((f) => !/onlytopoffers/.test(f) && (!/Rss_/.test(f) || FILTERS.some((k) => f.includes(`${k}=`))));
  const byId = new Map<string, Offer>();
  await mapPool(feeds, 6, async (f) => {
    try {
      for (const o of parseFeed(await getText(`${root}${f}`))) byId.set(o.id, o);
    } catch {
      // one broken feed only costs the offers that no other feed lists
    }
  });
  return [...byId.values()];
}

const bodyText = (o: Offer) => htmlToText(o.html);

export const talentsoftDetail: DetailFetcher = async (company, job) => {
  const id = job.external_id;
  const found = (await offers(company)).find((o) => o.id === id);
  return found ? bodyText(found) || null : null;
};

export const talentsoft: Adapter = async (company, ctx) => {
  const hint = defaultCountry(company.source_config);
  return (await offers(company))
    .filter((o) => !isEvergreen(o.title))
    .map((o): NormalizedJob => ({
      external_id: o.id,
      title: (ctx.known.get(o.id) ?? o.title).trim(),
      location_raw: o.city,
      remote: false,
      department: o.department,
      url: o.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: o.posted,
      country_hint: hint,
      description: ctx.known.has(o.id) ? null : bodyText(o),
    }));
};

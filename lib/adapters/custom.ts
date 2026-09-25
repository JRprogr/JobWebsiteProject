import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import { gkn, gknDetail } from "./gkn.ts";
import { kongsberg, kongsbergDetail } from "./kongsberg.ts";
import { euPortal, euPortalDetail } from "./euportal.ts";
import { linkList, linkListDetail } from "./linklist.ts";
import { safran, safranDetail } from "./safran.ts";
import { wixBoard, wixBoardDetail } from "./wixboard.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";

const USER_AGENT = "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

async function sitemapUrls(base: string): Promise<string[]> {
  const xml = await fetchText(new URL("/sitemap.xml", base).toString());
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeEntities(m[1]));
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Page = { title: string | null; text: string | null; postedAt?: string | null };

// DLR runs SAP SuccessFactors: the real title is in og:title, the whole listing (facts, tasks, profile) in the jobDisplay block.
export function parseDlrPage(html: string): Page {
  const og = html.match(/property="og:title"\s+content="([^"]*)"/)?.[1];
  const body = extractElement(html, 'class="jobDisplay"') ?? extractElement(html, 'itemprop="description"');
  return { title: og ? decodeEntities(og).trim() : null, text: body ? htmlToText(body) : null };
}

// CNES publishes schema.org JobPosting JSON-LD on every job page.
export function parseCnesPage(html: string): Page {
  const raw = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return { title: null, text: null };
  try {
    const j = JSON.parse(raw) as {
      title?: string;
      description?: string;
      datePosted?: string;
    };
    return {
      title: j.title ? decodeEntities(j.title).trim() : null,
      text: j.description ? htmlToText(j.description) : null,
      postedAt: j.datePosted ? new Date(j.datePosted).toISOString() : null,
    };
  } catch {
    return { title: null, text: null };
  }
}

type Item = { id: string; url: string; slugTitle: string; slugLocation: string };

async function sitemapAdapter(
  items: Item[],
  ctx: Parameters<Adapter>[1],
  fetchPage: (url: string) => Promise<Page>,
  opts: { cap: number; backfillCap: number; concurrency: number; delayMs: number },
): Promise<NormalizedJob[]> {
  const pages = new Map<string, Page>();
  const targets = items.filter((i) => !ctx.known.has(i.id)).slice(0, ctx.backfill ? opts.backfillCap : opts.cap);

  await mapPool(targets, opts.concurrency, async (item) => {
    try {
      pages.set(item.id, await fetchPage(item.url));
    } catch {
      // leave unprocessed; retried on the next run
    }
    if (opts.delayMs) await sleep(opts.delayMs);
  });

  return items.map((item): NormalizedJob => {
    const page = pages.get(item.id);
    return {
      external_id: item.id,
      title: page?.title || ctx.known.get(item.id) || item.slugTitle,
      location_raw: item.slugLocation,
      remote: false,
      department: null,
      url: item.url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: page?.postedAt ?? null,
      description: page ? (page.text ?? "") : null,
    };
  });
}

const dlr: Adapter = async (company, ctx) => {
  const base = String(company.source_config.base_url);
  const items: Item[] = [];
  for (const url of await sitemapUrls(base)) {
    const m = url.match(/\/job\/([^/]+)\/(\d+)\/?$/);
    if (!m) continue;
    const [city, ...titleParts] = decodeURIComponent(m[1]).split("-");
    items.push({ id: m[2], url, slugTitle: titleParts.join(" ").trim() || city, slugLocation: `${city}, Germany` });
  }
  return sitemapAdapter(items, ctx, async (url) => parseDlrPage(await fetchText(url)), {
    cap: 30,
    backfillCap: 600,
    concurrency: 3,
    delayMs: 150,
  });
};

// CNES: /fr/annonce/<id>-<title-words>[-hf][-<postcode>-<city> | -centre-spatial-guyanais]
const cnes: Adapter = async (company, ctx) => {
  const base = String(company.source_config.base_url);
  const items: Item[] = [];
  for (const url of await sitemapUrls(base)) {
    const m = url.match(/\/annonce\/(\d+)-(.+)$/);
    if (!m) continue;
    let slug = m[2];
    let location = "France";
    const guiana = slug.match(/-centre-spatial-guyanais$/);
    const postcode = slug.match(/-(\d{5})-([a-z-]+)$/);
    if (guiana) {
      slug = slug.slice(0, guiana.index);
      location = "Kourou, French Guiana";
    } else if (postcode) {
      slug = slug.slice(0, postcode.index);
      location = `${postcode[2].split("-").map(sentence).join(" ")}, France`;
    }
    items.push({ id: m[1], url, slugTitle: sentence(slug.replace(/-hf$/, "").replace(/-/g, " ").trim()), slugLocation: location });
  }
  // robots.txt asks for a 10 second crawl delay, so only a couple of pages per run
  return sitemapAdapter(items, ctx, async (url) => parseCnesPage(await fetchText(url)), {
    cap: 1,
    backfillCap: 50,
    concurrency: 1,
    delayMs: 10_000,
  });
};

const kinds: Record<string, { adapter: Adapter; detail: DetailFetcher }> = {
  "sitemap-dlr": { adapter: dlr, detail: async (_c, job) => parseDlrPage(await fetchText(job.url)).text },
  "sitemap-cnes": { adapter: cnes, detail: async (_c, job) => parseCnesPage(await fetchText(job.url)).text },
  "gkn-api": { adapter: gkn, detail: gknDetail },
  "kongsberg-web": { adapter: kongsberg, detail: kongsbergDetail },
  "link-list": { adapter: linkList, detail: linkListDetail },
  "eu-portal": { adapter: euPortal, detail: euPortalDetail },
  "wix-board": { adapter: wixBoard, detail: wixBoardDetail },
  "safran-web": { adapter: safran, detail: safranDetail },
};

const kindOf = (company: { slug: string; source_config: Record<string, unknown> }) => {
  const kind = company.source_config.kind;
  const entry = typeof kind === "string" ? kinds[kind] : undefined;
  if (!entry) throw new Error(`${company.slug}: unknown custom kind "${String(kind)}"`);
  return entry;
};

export const custom: Adapter = (company, ctx) => kindOf(company).adapter(company, ctx);
export const customDetail: DetailFetcher = (company, job) => kindOf(company).detail(company, job);

import { decodeEntities, htmlToText, parseJsonLd } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText, politeFetch } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// Intervieweb / zinrec career sites (Avio): <base>/en/career renders the first page of vacancies, later pages come from a POST to a
// CSRF-tokened URL embedded in that page. Every listing page carries schema.org JobPosting JSON-LD with description and date.
const base = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "base", company.slug).replace(/\/$/, "");

export function parseCards(html: string): Row[] {
  return html
    .split('class="row vacancy__render"')
    .slice(1)
    .flatMap((chunk): Row[] => {
      const link = /<a href="([^"]+\/jobs\/[^"]*?-(\d+)\/[a-z]{2}\/)"[^>]*>\s*<h3>([\s\S]*?)<\/h3>/.exec(chunk);
      if (!link) return [];
      const place = /title="Location"[\s\S]*?<\/span>([^<]*)</.exec(chunk)?.[1];
      const area = /title="Functional Area"[\s\S]*?<\/span>([^<]*)</.exec(chunk)?.[1];
      // "Colleferro Italia": the country name is glued to the city, and the board's default country covers it
      const city = place ? strip(place).replace(/\s+(?:Italia|Italy)$/i, "") : "";
      return [{ id: link[2], url: link[1], title: strip(link[3]), location: city || null, department: area ? strip(area) || null : null }];
    });
}

type Posting = { description?: string; datePosted?: string };

async function posting(url: string): Promise<{ text: string | null; posted: string | null }> {
  const html = await getText(url);
  for (const m of html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = parseJsonLd(m[1]) as Posting & { "@type"?: string };
      if (j["@type"] === "JobPosting") {
        const t = j.datePosted ? Date.parse(j.datePosted) : NaN;
        return { text: j.description ? htmlToText(j.description) || null : null, posted: Number.isNaN(t) ? null : new Date(t).toISOString() };
      }
    } catch {
      // not the JSON-LD we want
    }
  }
  return { text: null, posted: null };
}

export const interviewebDetail: DetailFetcher = async (_company, job) => (await posting(job.url)).text;

async function listAll(company: Company): Promise<Row[]> {
  const home = `${base(company)}/en/career`;
  const first = await politeFetch(home, { signal: AbortSignal.timeout(30_000) });
  if (!first.ok) throw new Error(`${first.status} for ${home}`);
  const html = await first.text();
  const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const rows = parseCards(html);
  const pages = Number(/Page 1 of (\d+)/.exec(html)?.[1] ?? 1);
  const endpoint = /id="url-for-announces" value="([^"]+)"/.exec(html)?.[1];
  const section = /'section':\s*'([^']+)'/.exec(html)?.[1];
  if (pages > 1 && endpoint && section) {
    for (let page = 2; page <= Math.min(pages, 20); page++) {
      const res = await politeFetch(decodeEntities(endpoint), {
        method: "POST",
        headers: { cookie, "x-requested-with": "XMLHttpRequest", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ act1: "vacancyListCareer", section, order: "name", page: String(page), country: "", region: "", function: "", project: "", text: "", division: "", company: "" }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`${res.status} from intervieweb page ${page}`);
      const json = (await res.json()) as { success?: boolean; data?: string };
      if (!json.success || !json.data) break;
      rows.push(...parseCards(json.data));
    }
  }
  return rows;
}

export const intervieweb: Adapter = async (company, ctx) => {
  const posted = new Map<string, string | null>();
  const jobs = await runBoard(company, ctx, await listAll(company), async (r) => {
    const p = await posting(r.url);
    posted.set(r.id, p.posted);
    return p.text;
  });
  return jobs.map((j) => ({ ...j, posted_at: posted.get(j.external_id) ?? null }));
};

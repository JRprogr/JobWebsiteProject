import { mapPool } from "../pool.ts";
import { htmlToText, parseJsonLd } from "../text.ts";
import { blocks, tagText } from "../xml.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getJson, getText, isEvergreen } from "./http.ts";

// Personio's public XML feed: https://<subdomain>.jobs.personio.<tld>/xml (tld is "de" or "com" depending on the account)
function base(company: Pick<Company, "slug" | "source_config">): string {
  const sub = configString(company.source_config, "subdomain", company.slug);
  const tld = typeof company.source_config.tld === "string" ? company.source_config.tld : "de";
  return `https://${sub}.jobs.personio.${tld}`;
}

type Position = { id: string; title: string; offices: string[]; department: string | null; createdAt: string | null; body: string };

function fromXml(p: string): Position | null {
  const id = tagText(p, "id");
  const title = tagText(p, "name");
  if (!id || !title) return null;
  const extra = blocks(blocks(p, "additionalOffices")[0] ?? "", "office").map((o) => o.trim());
  const body = blocks(p, "jobDescription")
    .map((d) => {
      const name = tagText(d, "name");
      const value = tagText(d, "value");
      return value ? `${name ? `${name}\n` : ""}${htmlToText(value)}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return {
    id,
    title,
    offices: [tagText(p, "office"), ...extra].filter((o): o is string => Boolean(o)),
    department: tagText(p, "department"),
    createdAt: tagText(p, "createdAt"),
    body,
  };
}

type SearchJson = { id: number; name: string; office?: string; offices?: string[]; department?: string; description?: string };

// A few accounts switch the XML feed off (404) but still serve the JSON their own careers page uses; it has no dates
async function positions(company: Company): Promise<Position[]> {
  const root = base(company);
  try {
    return blocks(await getText(`${root}/xml`), "position").flatMap((p) => fromXml(p) ?? []);
  } catch (e) {
    if (!String(e).startsWith("Error: 404")) throw e;
    const rows = await getJson<SearchJson[]>(`${root}/search.json`);
    return rows.map((r) => ({
      id: String(r.id),
      title: r.name,
      offices: r.offices?.length ? r.offices : r.office ? [r.office] : [],
      department: r.department ?? null,
      createdAt: null,
      body: htmlToText(r.description ?? ""),
    }));
  }
}

// Some accounts publish the feed without descriptions (Okapi Orbits: `<jobDescriptions></jobDescriptions>` on most positions) while
// the job's own page still carries the whole text in schema.org JobPosting JSON-LD.
async function pageText(root: string, id: string): Promise<string | null> {
  const html = await getText(`${root}/job/${id}`);
  for (const m of html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = parseJsonLd(m[1]) as { "@type"?: string; description?: string };
      if (j["@type"] === "JobPosting") return j.description ? htmlToText(j.description) || null : null;
    } catch {
      // not the JSON-LD we want
    }
  }
  return null;
}

export const personioDetail: DetailFetcher = async (company, job) => {
  const position = (await positions(company)).find((p) => p.id === job.external_id);
  return position?.body || (await pageText(base(company), job.external_id));
};

export const personio: Adapter = async (company, ctx) => {
  const root = base(company);
  const hint = defaultCountry(company.source_config);
  const list = (await positions(company)).filter((p) => !isEvergreen(p.title));
  // only jobs that are new to us and came without text; the rest of the text top-up is the details fetcher's job (lib/texts.ts)
  const missing = list.filter((p) => !p.body && !ctx.known.has(p.id)).slice(0, ctx.backfill ? 300 : 30);
  // a position still without text after this loop (page unreachable, or beyond the cap) reports `null` = not processed yet, so
  // the details top-up tries again; an empty string would mean "this source has no text"
  const unread = new Set(list.filter((p) => !p.body).map((p) => p.id));
  await mapPool(missing, 3, async (p) => {
    try {
      p.body = (await pageText(root, p.id)) ?? "";
      unread.delete(p.id);
    } catch {
      // stays unread
    }
  });
  return list.map((p): NormalizedJob => ({
    external_id: p.id,
    title: p.title,
    location_raw: [...new Set(p.offices)].join("; ") || null,
    remote: p.offices.some((o) => /remote/i.test(o)),
    department: p.department,
    url: `${root}/job/${p.id}`,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    posted_at: p.createdAt,
    country_hint: hint,
    description: ctx.known.has(p.id) || unread.has(p.id) ? null : p.body,
  }));
};

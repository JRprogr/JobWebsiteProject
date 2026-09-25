import { countryName } from "../geo.ts";
import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getJson, isEvergreen, politeFetch } from "./http.ts";

// Workable career sites: POST https://apply.workable.com/api/v3/accounts/<account>/jobs (list, paged by `token`),
// GET /api/v2/accounts/<account>/jobs/<shortcode> for the text.
type Item = {
  shortcode: string;
  title: string;
  remote?: boolean;
  workplace?: string | null;
  department?: string[] | null;
  published?: string | null;
  locations?: { city?: string | null; region?: string | null; country?: string | null; countryCode?: string | null; hidden?: boolean }[];
};

const account = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "account", company.slug);

async function list(company: Company): Promise<Item[]> {
  const acc = account(company);
  const out: Item[] = [];
  let token: string | undefined;
  for (let page = 0; page < 30; page++) {
    const res = await politeFetch(`https://apply.workable.com/api/v3/accounts/${acc}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: "", location: [], department: [], worktype: [], remote: [], ...(token ? { token } : {}) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} from workable ${acc}`);
    const body = (await res.json()) as { results: Item[]; nextPage?: string };
    out.push(...body.results);
    token = body.nextPage;
    if (!token || body.results.length === 0) break;
  }
  return out;
}

async function text(company: Pick<Company, "slug" | "source_config">, shortcode: string): Promise<string | null> {
  const j = await getJson<{ description?: string; requirements?: string; benefits?: string }>(
    `https://apply.workable.com/api/v2/accounts/${account(company)}/jobs/${encodeURIComponent(shortcode)}`,
  );
  return htmlToText([j.description, j.requirements, j.benefits].filter(Boolean).join("\n\n")) || null;
}

export const workableDetail: DetailFetcher = async (company, job) => text(company, job.external_id);

export const workable: Adapter = async (company, ctx) => {
  const acc = account(company);
  const items = (await list(company)).filter((i) => !isEvergreen(i.title));
  return Promise.all(
    items.map(async (i): Promise<NormalizedJob> => {
      let description: string | null = null;
      if (!ctx.known.has(i.shortcode)) {
        try {
          description = (await text(company, i.shortcode)) ?? "";
        } catch {
          // leave unprocessed; retried on the next run
        }
      }
      const places = (i.locations ?? []).filter((l) => !l.hidden).map((l) => [l.city, l.countryCode ? countryName(l.countryCode) : l.country].filter(Boolean).join(", "));
      return {
        external_id: i.shortcode,
        title: (ctx.known.get(i.shortcode) ?? i.title).trim(),
        location_raw: [...new Set(places.filter(Boolean))].join("; ") || null,
        remote: Boolean(i.remote) || i.workplace === "remote",
        department: i.department?.[0] ?? null,
        url: `https://apply.workable.com/${acc}/j/${i.shortcode}/`,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        posted_at: i.published ? new Date(i.published).toISOString() : null,
        description,
      };
    }),
  );
};

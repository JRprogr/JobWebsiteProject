import { mapPool, sleep } from "../pool.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getText, isEvergreen } from "./http.ts";

// UKG / UltiPro job boards (MDA Space): POST <board>/JobBoardView/LoadSearchResults for the list, and the
// <board>/OpportunityDetail?opportunityId=<guid> page embeds the full description as JSON.
type Opportunity = {
  Id: string;
  Title: string;
  RequisitionNumber?: string;
  JobCategoryName?: string | null;
  PostedDate?: string | null;
  Locations?: { LocalizedDescription?: string | null; Address?: { City?: string | null; Country?: { Code?: string; Name?: string } | null } | null }[];
};

const board = (company: Pick<Company, "slug" | "source_config">) => configString(company.source_config, "board", company.slug).replace(/\/$/, "");

async function list(company: Company): Promise<Opportunity[]> {
  const out: Opportunity[] = [];
  for (let skip = 0; skip < 2000; skip += 50) {
    const res = await fetch(`${board(company)}/JobBoardView/LoadSearchResults`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)" },
      body: JSON.stringify({
        opportunitySearch: {
          Top: 50, Skip: skip, QueryString: "",
          OrderBy: [{ Value: "postedDateDesc", PropertyName: "PostedDate", Ascending: false }],
          Filters: [4, 5, 6].map((fieldName) => ({ t: "TermsSearchFilterDto", fieldName, extra: null, values: [] })),
        },
        matchCriteria: { PreferredJobs: [], Criteria: [], SearchCriteria: [], SortCriteria: [] },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} from ultipro board`);
    const page = (await res.json()) as { opportunities: Opportunity[]; totalCount: number };
    out.push(...page.opportunities);
    if (out.length >= page.totalCount || page.opportunities.length === 0) break;
    await sleep(100);
  }
  return out;
}

async function description(company: Pick<Company, "slug" | "source_config">, id: string): Promise<string | null> {
  const html = await getText(`${board(company)}/OpportunityDetail?opportunityId=${encodeURIComponent(id)}`);
  const m = /"Description"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (!m) return null;
  try {
    return htmlToText(decodeEntities(JSON.parse(`"${m[1]}"`) as string)) || null;
  } catch {
    return null;
  }
}

export const ultiproDetail: DetailFetcher = async (company, job) => description(company, job.external_id);

export const ultipro: Adapter = async (company, ctx) => {
  const b = board(company);
  const items = (await list(company)).filter((o) => !isEvergreen(o.Title));

  const targets = items.filter((o) => !ctx.known.has(o.Id)).slice(0, ctx.backfill ? 300 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (o) => {
    try {
      texts.set(o.Id, await description(company, o.Id));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return items.map((o): NormalizedJob => {
    const places = (o.Locations ?? []).map((l) => [l.Address?.City, l.Address?.Country?.Name].filter(Boolean).join(", ") || l.LocalizedDescription || "").filter(Boolean);
    return {
      external_id: o.Id,
      title: (ctx.known.get(o.Id) ?? o.Title).trim(),
      location_raw: [...new Set(places)].join("; ") || null,
      remote: false,
      department: o.JobCategoryName ?? null,
      url: `${b}/OpportunityDetail?opportunityId=${o.Id}`,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: o.PostedDate ? new Date(o.PostedDate).toISOString() : null,
      description: texts.has(o.Id) ? (texts.get(o.Id) ?? "") : null,
    };
  });
};


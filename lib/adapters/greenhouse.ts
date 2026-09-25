import { mapPool } from "../pool.ts";
import { decodeEntities, htmlToText } from "../text.ts";
import type { Adapter, AdapterContext, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { isEvergreen, politeFetch } from "./http.ts";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string } | null;
  first_published?: string | null;
  updated_at?: string | null;
  pay_input_ranges?: { min_cents: number; max_cents: number; currency_type: string }[] | null;
};

type GhDepartment = { name: string; jobs?: { id: number }[]; children?: GhDepartment[] };

// Above this many unprocessed jobs one bulk request is cheaper than one request per job
const BULK_THRESHOLD = 40;

async function getJson<T>(url: string): Promise<T> {
  const res = await politeFetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`greenhouse ${res.status} for ${url}`);
  return (await res.json()) as T;
}

type Config = { slug: string; source_config: Record<string, unknown> };

// A company may publish on several boards (e.g. SpaceX has a separate international board): board_token is the main one, extra_board_tokens the rest
function tokens(company: Config): string[] {
  const main = company.source_config.board_token;
  if (typeof main !== "string") throw new Error(`${company.slug}: source_config.board_token missing`);
  const extra = company.source_config.extra_board_tokens;
  return [main, ...(Array.isArray(extra) ? extra.filter((t): t is string => typeof t === "string") : [])];
}

const boardApi = (token: string) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}`;

// Listing URLs look like https://job-boards.greenhouse.io/<token>/jobs/<id>; fall back to the main board
function tokenFromUrl(company: Config, url: string): string {
  const all = tokens(company);
  const m = url.match(/greenhouse\.io\/([^/]+)\/jobs\//);
  return m && all.includes(m[1]) ? m[1] : all[0];
}

const bodyText = (content: string | undefined | null) => (content ? htmlToText(decodeEntities(content)) : null);

function departmentIndex(depts: GhDepartment[]): Map<number, string> {
  const byJob = new Map<number, string>();
  const walk = (d: GhDepartment) => {
    for (const j of d.jobs ?? []) if (!byJob.has(j.id)) byJob.set(j.id, d.name);
    d.children?.forEach(walk);
  };
  depts.forEach(walk);
  return byJob;
}

export const greenhouseDetail: DetailFetcher = async (company, job) => {
  const j = await getJson<{ content?: string }>(`${boardApi(tokenFromUrl(company, job.url))}/jobs/${encodeURIComponent(job.external_id)}`);
  return bodyText(j.content);
};

async function fetchBoard(company: Company, token: string, ctx: AdapterContext): Promise<NormalizedJob[]> {
  const api = boardApi(token);

  const [{ jobs }, { departments }] = await Promise.all([
    getJson<{ jobs: GhJob[] }>(`${api}/jobs`),
    getJson<{ departments: GhDepartment[] }>(`${api}/departments`),
  ]);
  const deptByJob = departmentIndex(departments);

  const unknown = jobs.filter((j) => !ctx.known.has(String(j.id)));
  const text = new Map<number, string>();
  try {
    if (unknown.length > BULK_THRESHOLD) {
      const want = new Set(unknown.map((j) => j.id));
      const full = await getJson<{ jobs: { id: number; content?: string }[] }>(`${api}/jobs?content=true`);
      for (const f of full.jobs) {
        if (want.has(f.id)) text.set(f.id, bodyText(f.content) ?? "");
      }
    } else {
      await mapPool(unknown.slice(0, ctx.backfill ? 500 : 25), 5, async (j) => {
        try {
          const t = await greenhouseDetail(company, { external_id: String(j.id), url: j.absolute_url });
          text.set(j.id, t ?? "");
        } catch {
          // leave unprocessed; retried on the next run
        }
      });
    }
  } catch {
    // detail text is best-effort; the listing itself still succeeds
  }

  return jobs.map((j): NormalizedJob => {
    const pay = j.pay_input_ranges?.[0];
    const location = j.location?.name?.trim() || null;
    return {
      external_id: String(j.id),
      title: decodeEntities(j.title).trim(),
      location_raw: location,
      remote: /\bremote\b/i.test(location ?? ""),
      department: deptByJob.get(j.id) ?? null,
      url: j.absolute_url,
      salary_min: pay ? Math.round(pay.min_cents / 100) : null,
      salary_max: pay ? Math.round(pay.max_cents / 100) : null,
      salary_currency: pay?.currency_type ?? null,
      posted_at: j.first_published ?? j.updated_at ?? null,
      description: text.get(j.id) ?? null,
    };
  });
};

export const greenhouse: Adapter = async (company, ctx) => {
  const boards = await Promise.all(tokens(company).map((token) => fetchBoard(company, token, ctx)));
  // "Future Opportunities" / "Talent community" postings are evergreen entries, not open roles
  return boards.flat().filter((j) => !isEvergreen(j.title));
};

import { htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, isEvergreen, politeFetch } from "./http.ts";

// A careers page built on Base44 whose positions come from the company's Odoo (Involve Space): the page's own function
// `POST /api/apps/<app_id>/functions/odooJobs {"action":"get_all_published_positions"}` returns every published position with its
// full text, so one request covers the board. Used as the custom kind "base44-odoo".
//   source_config {base, app_id, default_country, places?: {"<Odoo address name>": "City, Country"}}
type Position = {
  id: number | string;
  name: string;
  is_virtual?: boolean;
  department_id?: [number, string] | false;
  address_id?: [number, string] | false;
  no_of_recruitment?: number;
  x_studio_ral_range_start?: number;
  x_studio_ral_range_end?: number;
  x_studio_job_description?: string | false;
  x_studio_responsibilities?: string | false;
  x_studio_must_have?: string | false;
  x_studio_nice_to_have?: string | false;
};

async function positions(company: { slug: string; source_config: Record<string, unknown> }): Promise<Position[]> {
  const base = configString(company.source_config, "base", company.slug).replace(/\/$/, "");
  const appId = configString(company.source_config, "app_id", company.slug);
  const res = await politeFetch(`${base}/api/apps/${appId}/functions/odooJobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "get_all_published_positions" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${base}/api/apps/${appId}/functions/odooJobs`);
  return ((await res.json()) as { positions?: Position[] }).positions ?? [];
}

const SECTIONS: [string, keyof Position][] = [
  ["", "x_studio_job_description"],
  ["Responsibilities", "x_studio_responsibilities"],
  ["Requirements", "x_studio_must_have"],
  ["Nice to have", "x_studio_nice_to_have"],
];

function textOf(p: Position): string {
  return SECTIONS.flatMap(([heading, key]) => {
    const html = p[key];
    const text = typeof html === "string" ? htmlToText(html).trim() : "";
    return text ? [heading ? `${heading}\n${text}` : text] : [];
  }).join("\n\n");
}

// "Open application" style entries have no text and nobody to hire: the virtual ones the page adds itself, plain "Internship" and the like
const isEntry = (p: Position) => p.is_virtual === true || isEvergreen(p.name) || /^\s*internship\s*$/i.test(p.name);

export const base44Odoo: Adapter = async (company, ctx) => {
  const base = configString(company.source_config, "base", company.slug).replace(/\/$/, "");
  const places = (company.source_config.places ?? {}) as Record<string, string>;
  const hint = defaultCountry(company.source_config);
  const jobs: NormalizedJob[] = [];
  for (const p of await positions(company)) {
    if (isEntry(p)) continue;
    const id = String(p.id);
    const address = p.address_id ? p.address_id[1] : "";
    const place = Object.entries(places).find(([key]) => address.includes(key))?.[1] ?? null;
    const min = p.x_studio_ral_range_start || null;
    const max = p.x_studio_ral_range_end || null;
    jobs.push({
      external_id: id,
      title: (ctx.known.get(id) ?? p.name).trim(),
      location_raw: place,
      remote: false,
      department: p.department_id ? p.department_id[1] : null,
      url: `${base}/jobs/${id}`,
      salary_min: min,
      salary_max: max,
      salary_currency: min || max ? "EUR" : null,
      posted_at: null,
      country_hint: hint,
      description: ctx.known.has(id) ? null : textOf(p),
    });
  }
  return jobs;
};

export const base44OdooDetail: DetailFetcher = async (company, job) => {
  const p = (await positions(company)).find((x) => String(x.id) === job.external_id);
  return p ? textOf(p) || null : null;
};

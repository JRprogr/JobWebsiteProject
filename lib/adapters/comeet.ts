import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, defaultCountry, getText, isEvergreen } from "./http.ts";

// Comeet career sites (Covenant): source_config {url} = the company's page on www.comeet.com/jobs/<company>/<id>. The page embeds every open
// position as JSON (COMPANY_POSITIONS_DATA), listing text included, so one request covers the whole board.
type Position = {
  uid: string;
  name: string;
  department?: string | null;
  location?: { name?: string | null; city?: string | null; country?: string | null; is_remote?: boolean } | null;
  workplace_type?: string | null;
  url_active_page?: string | null;
  url_comeet_hosted_page?: string | null;
  time_updated?: string | null;
  custom_fields?: { details?: { name?: string; value?: string }[] } | null;
};

const MARKER = "COMPANY_POSITIONS_DATA = ";

async function positions(company: Pick<Company, "slug" | "source_config">): Promise<Position[]> {
  const html = await getText(configString(company.source_config, "url", company.slug));
  const start = html.indexOf(MARKER);
  if (start < 0) throw new Error(`${company.slug}: no COMPANY_POSITIONS_DATA on the Comeet page`);
  // the assignment ends with "];" at the end of its line; a position's own text can contain "];" only inside a JSON string, never followed by a newline
  const from = start + MARKER.length;
  const end = html.indexOf("];\n", from);
  const json = html.slice(from, end > 0 ? end + 1 : html.indexOf("];", from) + 1);
  return JSON.parse(json) as Position[];
}

const bodyText = (p: Position) => htmlToText((p.custom_fields?.details ?? []).map((d) => d.value ?? "").join("\n\n")) || null;

export const comeetDetail: DetailFetcher = async (company, job) => {
  const p = (await positions(company)).find((x) => x.uid === job.external_id);
  return p ? bodyText(p) : null;
};

export const comeet: Adapter = async (company, ctx) => {
  const hint = defaultCountry(company.source_config);
  return (await positions(company))
    .filter((p) => !isEvergreen(p.name))
    .map((p): NormalizedJob => ({
      external_id: p.uid,
      title: p.name.trim(),
      location_raw: p.location?.name?.trim() || null,
      remote: Boolean(p.location?.is_remote) || p.workplace_type === "Remote",
      department: p.department ?? null,
      url: p.url_active_page ?? p.url_comeet_hosted_page ?? configString(company.source_config, "url", company.slug),
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
      country_hint: hint,
      description: ctx.known.has(p.uid) ? null : bodyText(p),
    }));
};

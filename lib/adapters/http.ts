export const USER_AGENT = "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)";

async function get(url: string, accept: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}

export async function getText(url: string, timeoutMs = 30_000): Promise<string> {
  return (await get(url, "*/*", timeoutMs)).text();
}

export async function getJson<T>(url: string, timeoutMs = 40_000): Promise<T> {
  return (await get(url, "application/json", timeoutMs)).json() as Promise<T>;
}

export function configString(config: Record<string, unknown>, key: string, slug: string): string {
  const value = config[key];
  if (typeof value !== "string" || !value) throw new Error(`${slug}: source_config.${key} missing`);
  return value;
}

// ISO-2 code used when a listing names no country the parser can resolve (most of these companies hire in one country)
export function defaultCountry(config: Record<string, unknown>): string | null {
  return typeof config.default_country === "string" ? config.default_country : null;
}

// Evergreen "send us your CV anyway" entries are not open roles, so the ATS adapters leave them out
const EVERGREEN = /initiativbewerbung|unsolicited|spontaneous|spontan[ée]e?|open application|general application|talent pool|talent community|talented individuals|bassin de talents|åpen søknad|åben ansøgning|candidatura (?:spontanea|espontánea)|autocandidatura|generic application|future opportunit/i;
export const isEvergreen = (title: string) => EVERGREEN.test(title);

// "Chennai, IN" / "Betzdorf, LU, L-6815": the two capitals after the city are an ISO country code, and the location parser would
// read some of those as US states (IN = Indiana), so hand the code over as a hint and keep just the place name
export function isoPlace(raw: string | null): { place: string | null; country: string | null } {
  const m = raw?.match(/^(.+?),\s*([A-Z]{2})(?:\s*,\s*[^,]*\d[^,]*)?$/);
  return m ? { place: m[1].trim(), country: m[2] } : { place: raw, country: null };
}

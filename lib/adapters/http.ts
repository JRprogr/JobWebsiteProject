import { CONTACT_EMAIL, SITE_URL } from "../site.ts";
import { sleep } from "../pool.ts";

// Employers can see who is fetching their page: the bot's name, a page that explains it and how to opt out, and a mailbox.
// Outside a deployed environment SITE_URL is localhost, which is no use to anyone, so only the mailbox is given then.
const ABOUT = /^https?:\/\/localhost/.test(SITE_URL) ? CONTACT_EMAIL : `+${SITE_URL}/faq; ${CONTACT_EMAIL}`;
export const USER_AGENT = `Mozilla/5.0 (compatible; DSCareersBot/0.1; ${ABOUT})`;

// A rate limit or a briefly unavailable source is worth another try after a pause; anything else is the caller's problem
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const ATTEMPTS = 3;
const MAX_WAIT_MS = 20_000;

function waitMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  const seconds = header === null ? NaN : /^\d+$/.test(header) ? Number(header) : (Date.parse(header) - Date.now()) / 1000;
  return Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : attempt * 3_000, MAX_WAIT_MS);
}

// fetch() for every adapter: identifies the bot and retries rate limits and 5xx blips with a pause (Retry-After when given).
// The caller's abort signal keeps counting across attempts, so a slow source still ends at the caller's own timeout.
export async function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (timedOut || attempt === ATTEMPTS) throw err;
      await sleep(attempt * 2_000); // dropped connection
      continue;
    }
    if (!RETRY_STATUS.has(res.status) || attempt === ATTEMPTS) return res;
    await res.body?.cancel();
    await sleep(waitMs(res, attempt));
  }
}

async function get(url: string, accept: string, timeoutMs: number): Promise<Response> {
  const res = await politeFetch(url, { headers: { accept }, signal: AbortSignal.timeout(timeoutMs) });
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

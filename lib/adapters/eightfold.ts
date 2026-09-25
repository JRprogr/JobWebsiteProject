import { countryName } from "../geo.ts";
import { mapPool, sleep } from "../pool.ts";
import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher, NormalizedJob } from "../types.ts";
import { configString, getJson, isEvergreen } from "./http.ts";

// Eightfold career sites (Lockheed Martin): the public "PCSX" JSON API behind the careers page.
//   <base>/api/pcsx/search?domain=<domain>&query=&location=<text>&start=N   (10 per page, whatever `num` says)
//   <base>/api/pcsx/position_details?position_id=<id>&domain=<domain>       (description)
// Lockheed lists ~5,000 roles worldwide, so source_config.locations names the countries to query and only positions whose
// location carries one of the Europe ISO-3 codes below are kept.
type Position = {
  id: number;
  displayJobId?: string;
  name: string;
  locations?: string[];
  department?: string | null;
  postedTs?: number;
  workLocationOption?: string | null;
  positionUrl: string;
};

const EUROPE_ISO3: Record<string, string> = {
  GBR: "GB", IRL: "IE", FRA: "FR", DEU: "DE", ITA: "IT", ESP: "ES", PRT: "PT", NLD: "NL", BEL: "BE", LUX: "LU", CHE: "CH", AUT: "AT",
  NOR: "NO", SWE: "SE", DNK: "DK", FIN: "FI", ISL: "IS", POL: "PL", CZE: "CZ", SVK: "SK", HUN: "HU", ROU: "RO", BGR: "BG", GRC: "GR",
  HRV: "HR", SVN: "SI", EST: "EE", LVA: "LV", LTU: "LT", TUR: "TR", ALB: "AL", MNE: "ME", MKD: "MK", SRB: "RS", BIH: "BA",
};

function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  const locations = Array.isArray(c.locations) ? c.locations.filter((l): l is string => typeof l === "string") : [];
  if (locations.length === 0) throw new Error(`${company.slug}: source_config.locations missing`);
  return { base: configString(c, "base", company.slug).replace(/\/$/, ""), domain: configString(c, "domain", company.slug), locations };
}

const search = (base: string, domain: string, location: string, start: number) =>
  `${base}/api/pcsx/search?domain=${encodeURIComponent(domain)}&query=&location=${encodeURIComponent(location)}&start=${start}`;

async function positions(company: Company): Promise<Position[]> {
  const { base, domain, locations } = cfg(company);
  const byId = new Map<number, Position>();
  for (const location of locations) {
    for (let start = 0; start < 400; start += 10) {
      const res = await getJson<{ data: { positions: Position[]; count: number } }>(search(base, domain, location, start));
      for (const p of res.data.positions) byId.set(p.id, p);
      if (res.data.positions.length < 10 || start + 10 >= res.data.count) break;
      await sleep(80);
    }
  }
  return [...byId.values()];
}

// "Havant, GBR" -> [{ city: "Havant", country: "GB" }]; keeps only European entries
function european(p: Position): { city: string; country: string }[] {
  return (p.locations ?? []).flatMap((l) => {
    const m = /^(.*?),?\s*([A-Z]{3})$/.exec(l.trim());
    const country = m ? EUROPE_ISO3[m[2]] : undefined;
    return m && country ? [{ city: m[1].trim(), country }] : [];
  });
}

async function description(company: Pick<Company, "slug" | "source_config">, id: string): Promise<string | null> {
  const { base, domain } = cfg(company);
  const res = await getJson<{ data: { jobDescription?: string } }>(
    `${base}/api/pcsx/position_details?position_id=${encodeURIComponent(id)}&domain=${encodeURIComponent(domain)}&hl=en`,
  );
  return res.data.jobDescription ? htmlToText(res.data.jobDescription) || null : null;
}

export const eightfoldDetail: DetailFetcher = async (company, job) => description(company, job.external_id);

export const eightfold: Adapter = async (company, ctx) => {
  const { base } = cfg(company);
  const kept = (await positions(company)).filter((p) => !isEvergreen(p.name) && european(p).length > 0);

  const targets = kept.filter((p) => !ctx.known.has(String(p.id))).slice(0, ctx.backfill ? 400 : 30);
  const texts = new Map<string, string | null>();
  await mapPool(targets, 3, async (p) => {
    try {
      texts.set(String(p.id), await description(company, String(p.id)));
    } catch {
      // leave unprocessed; retried on the next run
    }
    await sleep(120);
  });

  return kept.map((p): NormalizedJob => {
    const id = String(p.id);
    const places = european(p).map((l) => `${l.city ? `${l.city}, ` : ""}${countryName(l.country)}`);
    return {
      external_id: id,
      title: (ctx.known.get(id) ?? p.name).trim(),
      location_raw: [...new Set(places)].join("; ") || null,
      remote: p.workLocationOption === "remote",
      department: p.department ?? null,
      url: `${base}${p.positionUrl}`,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: p.postedTs ? new Date(p.postedTs * 1000).toISOString() : null,
      description: texts.has(id) ? (texts.get(id) ?? "") : null,
    };
  });
};

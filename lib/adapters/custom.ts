import type { Adapter, NormalizedJob } from "../types.ts";

const USER_AGENT = "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)";

async function sitemapUrls(base: string): Promise<string[]> {
  const url = new URL("/sitemap.xml", base).toString();
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`sitemap ${res.status} for ${url}`);
  const decode = (t: string) =>
    t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// DLR runs SAP SuccessFactors; job URLs look like /job/<City>-<Title-words>/<id>/
const dlr: Adapter = async (company) => {
  const base = String(company.source_config.base_url);
  const jobs: NormalizedJob[] = [];
  for (const url of await sitemapUrls(base)) {
    const m = url.match(/\/job\/([^/]+)\/(\d+)\/?$/);
    if (!m) continue;
    const [city, ...titleParts] = decodeURIComponent(m[1]).split("-");
    jobs.push({
      external_id: m[2],
      title: titleParts.join(" ").trim() || city,
      location_raw: `${city}, Germany`,
      remote: false,
      department: null,
      url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
    });
  }
  return jobs;
};

// CNES: /fr/annonce/<id>-<title-words>[-hf][-<postcode>-<city> | -centre-spatial-guyanais]
const cnes: Adapter = async (company) => {
  const base = String(company.source_config.base_url);
  const jobs: NormalizedJob[] = [];
  for (const url of await sitemapUrls(base)) {
    const m = url.match(/\/annonce\/(\d+)-(.+)$/);
    if (!m) continue;
    let slug = m[2];
    let location = "France";
    const guiana = slug.match(/-centre-spatial-guyanais$/);
    const postcode = slug.match(/-(\d{5})-([a-z-]+)$/);
    if (guiana) {
      slug = slug.slice(0, guiana.index);
      location = "Kourou, French Guiana";
    } else if (postcode) {
      slug = slug.slice(0, postcode.index);
      location = `${postcode[2].split("-").map(sentence).join(" ")}, France`;
    }
    const title = sentence(slug.replace(/-hf$/, "").replace(/-/g, " ").trim());
    jobs.push({
      external_id: m[1],
      title,
      location_raw: location,
      remote: false,
      department: null,
      url,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      posted_at: null,
    });
  }
  return jobs;
};

const kinds: Record<string, Adapter> = { "sitemap-dlr": dlr, "sitemap-cnes": cnes };

export const custom: Adapter = (company) => {
  const kind = company.source_config.kind;
  const adapter = typeof kind === "string" ? kinds[kind] : undefined;
  if (!adapter) return Promise.reject(new Error(`${company.slug}: unknown custom kind "${String(kind)}"`));
  return adapter(company);
};

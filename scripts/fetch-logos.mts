// Downloads a logo per company into public/logos/<slug>.png (128x128, transparent, contained) and records
// logo_url in db/seed/companies.json. Usage: node scripts/fetch-logos.mts [slug ...]   (no args = every company missing a logo)
// Company websites live in db/seed/websites.json (slug -> domain), because careers URLs often point at an ATS host.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SEED = "db/seed/companies.json";
const OUT = "public/logos";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const seed = JSON.parse(readFileSync(SEED, "utf8")) as { slug: string; name: string; logo_url?: string | null }[];
const websites = JSON.parse(readFileSync("db/seed/websites.json", "utf8")) as Record<string, string>;
const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

async function get(url: string, kind: "text" | "buffer"): Promise<string | Buffer | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return kind === "text" ? await res.text() : Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

type Candidate = { url: string; rank: number; label: string };

function iconCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || !/icon/.test(rel)) continue;
    const size = Number(/sizes=["'](\d+)x\d+/i.exec(tag)?.[1] ?? 0);
    const type = /type=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    let url: string;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (/\.ico(\?|$)/i.test(url)) continue; // sharp cannot decode .ico
    const svg = /svg/i.test(type) || /\.svg(\?|$)/i.test(url);
    const apple = rel.includes("apple-touch");
    out.push({ url, rank: (svg ? 1000 : 0) + (apple ? 500 : 0) + size, label: `${svg ? "svg" : apple ? "apple-touch" : "icon"}${size ? " " + size : ""}` });
  }
  return out.sort((a, b) => b.rank - a.rank);
}

async function tryImage(buf: Buffer, minSide: number): Promise<Buffer | null> {
  try {
    const img = sharp(buf, { density: 300 });
    const meta = await img.metadata();
    if (meta.format !== "svg" && Math.min(meta.width ?? 0, meta.height ?? 0) < minSide) return null;
    return await img.resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  } catch {
    return null;
  }
}

async function fetchLogo(domain: string): Promise<{ png: Buffer; source: string } | null> {
  const html = (await get(`https://${domain}`, "text")) as string | null;
  if (html) {
    for (const c of iconCandidates(html, `https://${domain}/`).slice(0, 4)) {
      const buf = (await get(c.url, "buffer")) as Buffer | null;
      const png = buf ? await tryImage(buf, 64) : null;
      if (png) return { png, source: `site ${c.label}` };
    }
  }
  for (const host of ["t3", "t2", "t1"]) {
    const buf = (await get(`https://${host}.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`, "buffer")) as Buffer | null;
    const png = buf ? await tryImage(buf, 32) : null;
    if (png) return { png, source: "gstatic favicon" };
  }
  return null;
}

// Companies whose homepage icon is wrong or unusable (a product photo, a wordmark that needs its own background) name the exact file instead.
type Override = { url: string; background?: string; size?: number; svg?: (text: string) => string };
const OVERRIDES: Record<string, Override> = {
  // The site icon is a white-on-transparent mark made for a dark header, so it gets a navy disc
  swissto12: { url: "https://swissto12.com/wp-content/uploads/2024/06/logo.svg", background: "#0b1f3a", size: 96 },
  novaspace: { url: "https://nova.space/wp-content/uploads/2024/07/emblem.png", size: 104 },
  // Wordmark on black, with "AST" in white like the brand's dark-background version (the SVG has it orange like the rest)
  "ast-spacemobile": {
    url: "https://irp.cdn-website.com/bbb776b9/dms3rep/multi/ASTSpace-Logo.svg",
    background: "#000000",
    size: 118,
    svg: (text) => {
      let n = 0;
      return text.replace(/fill="#F5A145"/g, (m) => (n++ < 3 ? 'fill="#FFFFFF"' : m));
    },
  },
};

async function fromOverride(o: Override): Promise<Buffer | null> {
  const raw = (await get(o.url, "buffer")) as Buffer | null;
  if (!raw) return null;
  const source = o.svg ? Buffer.from(o.svg(raw.toString("utf8"))) : raw;
  const size = o.size ?? 128;
  const fitted = await sharp(source, { density: 400 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const canvas = sharp({ create: { width: 128, height: 128, channels: 4, background: o.background ?? { r: 0, g: 0, b: 0, alpha: 0 } } });
  return canvas.composite([{ input: fitted, gravity: "center" }]).png().toBuffer();
}

// Logos supplied by hand (screenshots, brand-centre downloads): the source lives in db/seed/logo-sources/<slug>.png.
//  key   the source has a solid background (a screenshot on a dark or grey page): make it transparent so the mark sits on the white disc
//  bg    the mark needs its own background (white-on-black marks): fill the whole tile with this colour
//  crop  use only this part of the source (an emblem out of a wide logo)
//  size  longest side of the mark inside the 128x128 tile
type Local = { key?: boolean; bg?: string; crop?: { left: number; top: number; width: number; height: number }; size?: number };
const LOCAL: Record<string, Local> = {
  northstar: { crop: { left: 1, top: 2, width: 125, height: 108 }, key: true, size: 112 },
  ses: { size: 110 },
  list: { crop: { left: 284, top: 0, width: 71, height: 75 }, size: 100 },
  visionspace: { key: true, size: 100 },
  "d-orbit": { bg: "#010101", size: 128 },
  "lockheed-martin": { key: true, size: 100 },
  gmv: { key: true, size: 112 },
  "boeing-space": { key: true, size: 100 },
  "aac-clyde-space": { key: true, size: 100 },
  avio: { key: true, size: 116 },
  euspa: { key: true, size: 116 },
  neuraspace: { bg: "#01002a", size: 128 },
  gtd: { key: true, size: 100 },
  isptech: { bg: "#000000", size: 128 },
  amphinicy: { key: true, size: 92 },
  isispace: { key: true, size: 116 },
  // the brand-centre logotype (blue): only the roundel and "esa", not the line of text below them
  esa: { crop: { left: 1150, top: 1150, width: 3700, height: 1450 }, size: 116 },
};

// Turns the solid background (the top-left pixel's colour) transparent. Edge pixels are blends of mark and background, so their
// colour is un-mixed from the background as well, which avoids a dark or grey halo on the white disc.
async function keyOut(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
    const a = Math.min(1, Math.max(0, (d - 10) / 60));
    for (let c = 0; c < 3; c++) data[i + c] = a > 0 ? Math.min(255, Math.max(0, Math.round((data[i + c] - (1 - a) * bg[c]) / a))) : 0;
    data[i + 3] = Math.round(a * (data[i + 3] / 255) * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function fromLocal(slug: string, o: Local): Promise<Buffer> {
  let img = sharp(readFileSync(`db/seed/logo-sources/${slug}.png`));
  if (o.crop) img = sharp(await img.extract(o.crop).png().toBuffer());
  let buf: Buffer = await img.png().toBuffer();
  if (o.key) buf = await keyOut(buf);
  // trimming only makes sense once the margin is uniform (keyed to transparent, or already transparent)
  if (o.key || (await sharp(buf).metadata()).hasAlpha) buf = await sharp(buf).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const size = o.size ?? 104;
  const fitted = await sharp(buf).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: 128, height: 128, channels: 4, background: o.bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toBuffer();
}

let changed = false;
for (const c of seed) {
  if (only.length ? !only.includes(c.slug) : c.logo_url) continue;
  const local = LOCAL[c.slug];
  if (local) {
    writeFileSync(`${OUT}/${c.slug}.png`, await fromLocal(c.slug, local));
    c.logo_url = `/logos/${c.slug}.png`;
    changed = true;
    console.log(`${c.slug.padEnd(26)} local db/seed/logo-sources/${c.slug}.png`);
    continue;
  }
  const override = OVERRIDES[c.slug];
  if (override) {
    const png = await fromOverride(override);
    if (png) {
      writeFileSync(`${OUT}/${c.slug}.png`, png);
      c.logo_url = `/logos/${c.slug}.png`;
      changed = true;
      console.log(`${c.slug.padEnd(26)} override ${override.url}`);
    } else console.log(`${c.slug.padEnd(26)} override FAILED ${override.url}`);
    continue;
  }
  const domain = websites[c.slug];
  if (!domain) {
    console.log(`${c.slug.padEnd(26)} NO DOMAIN in db/seed/websites.json`);
    continue;
  }
  const found = await fetchLogo(domain);
  if (!found) {
    console.log(`${c.slug.padEnd(26)} ${domain.padEnd(26)} NOT FOUND`);
    continue;
  }
  writeFileSync(`${OUT}/${c.slug}.png`, found.png);
  c.logo_url = `/logos/${c.slug}.png`;
  changed = true;
  console.log(`${c.slug.padEnd(26)} ${domain.padEnd(26)} ${found.source}`);
}
if (changed) writeFileSync(SEED, JSON.stringify(seed, null, 2) + "\n");

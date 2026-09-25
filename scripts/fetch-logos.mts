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

let changed = false;
for (const c of seed) {
  if (only.length ? !only.includes(c.slug) : c.logo_url) continue;
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

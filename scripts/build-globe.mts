import { readFileSync, writeFileSync } from "node:fs";
import { feature, mesh } from "topojson-client";
import { geoArea, geoBounds, geoCentroid, geoContains } from "d3-geo";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

// Builds lib/geo/world-globe.json for components/GlobeMap.tsx: per country a label point, its extent, and land dots on two
// equal-area lattices (a coarse one for the whole-globe view, a fine one for zoomed-in views), plus decimated outlines.
// `node scripts/build-globe.mts`. Needs the dev dependencies (d3-geo, topojson-client, world-atlas); the app only reads the JSON.

type Tier = "eu" | "europe" | "near" | "world";

// ISO 3166-1 numeric (what world-atlas uses as feature id) -> alpha-2
const NUMERIC: Record<string, string> = Object.fromEntries(
  `004 AF,008 AL,012 DZ,016 AS,020 AD,024 AO,028 AG,031 AZ,032 AR,036 AU,040 AT,044 BS,048 BH,050 BD,051 AM,052 BB,056 BE,060 BM,064 BT,068 BO,070 BA,072 BW,076 BR,084 BZ,086 IO,090 SB,092 VG,096 BN,100 BG,104 MM,108 BI,112 BY,116 KH,120 CM,124 CA,132 CV,136 KY,140 CF,144 LK,148 TD,152 CL,156 CN,158 TW,162 CX,166 CC,170 CO,174 KM,175 YT,178 CG,180 CD,184 CK,188 CR,191 HR,192 CU,196 CY,203 CZ,204 BJ,208 DK,212 DM,214 DO,218 EC,222 SV,226 GQ,231 ET,232 ER,233 EE,234 FO,238 FK,239 GS,242 FJ,246 FI,248 AX,250 FR,254 GF,258 PF,260 TF,262 DJ,266 GA,268 GE,270 GM,275 PS,276 DE,288 GH,292 GI,296 KI,300 GR,304 GL,308 GD,312 GP,316 GU,320 GT,324 GN,328 GY,332 HT,334 HM,336 VA,340 HN,344 HK,348 HU,352 IS,356 IN,360 ID,364 IR,368 IQ,372 IE,376 IL,380 IT,384 CI,388 JM,392 JP,398 KZ,400 JO,404 KE,408 KP,410 KR,414 KW,417 KG,418 LA,422 LB,426 LS,428 LV,430 LR,434 LY,438 LI,440 LT,442 LU,446 MO,450 MG,454 MW,458 MY,462 MV,466 ML,470 MT,474 MQ,478 MR,480 MU,484 MX,492 MC,496 MN,500 MS,498 MD,499 ME,504 MA,508 MZ,512 OM,516 NA,520 NR,524 NP,528 NL,531 CW,533 AW,534 SX,540 NC,548 VU,554 NZ,558 NI,562 NE,566 NG,570 NU,574 NF,578 NO,580 MP,583 FM,584 MH,585 PW,586 PK,591 PA,598 PG,600 PY,604 PE,608 PH,612 PN,616 PL,620 PT,624 GW,626 TL,630 PR,634 QA,638 RE,642 RO,643 RU,646 RW,652 BL,654 SH,659 KN,660 AI,662 LC,663 MF,666 PM,670 VC,674 SM,678 ST,682 SA,686 SN,688 RS,690 SC,694 SL,702 SG,703 SK,704 VN,705 SI,706 SO,710 ZA,716 ZW,724 ES,728 SS,729 SD,732 EH,740 SR,744 SJ,748 SZ,752 SE,756 CH,760 SY,762 TJ,764 TH,768 TG,772 TK,776 TO,780 TT,784 AE,788 TN,792 TR,795 TM,796 TC,798 TV,800 UG,804 UA,807 MK,818 EG,826 GB,831 GG,832 JE,833 IM,834 TZ,840 US,850 VI,854 BF,858 UY,860 UZ,862 VE,876 WF,882 WS,887 YE,894 ZM`
    .split(",")
    .map((p) => p.split(" ") as [string, string]),
);
const BY_NAME: Record<string, string> = { Kosovo: "XK", Somaliland: "SO", "N. Cyprus": "CY" };
const SKIP = new Set(["AQ", "TF", "HM", "GS", "IO"]);

const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));
const EUROPE = new Set("GB NO CH IS LI RS BA AL MK ME XK AD MC SM".split(" "));
const NEAR = new Set("RU UA MD TR BY".split(" "));
const tierOf = (iso: string): Tier => (EU.has(iso) ? "eu" : EUROPE.has(iso) ? "europe" : NEAR.has(iso) ? "near" : "world");

// coarse: the whole globe, fine: zoomed in, ultra: zoomed in a lot (borders and country codes read there); each fades in over the last
const LEVELS: { step: number }[] = [{ step: 1.8 }, { step: 0.9 }, { step: 0.4 }];
const LAT_MIN = -56;
const LAT_MAX = 84;

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8")) as Topology;
const all = feature(topo, topo.objects.countries as GeometryCollection).features as Feature<Geometry, { name: string }>[];

type Part = { f: Feature<Geometry>; bounds: [[number, number], [number, number]] };
const parts = new Map<string, Part[]>();
const unmatched: string[] = [];
for (const f of all) {
  const iso = BY_NAME[f.properties.name] ?? NUMERIC[String(f.id).padStart(3, "0")];
  if (!iso) {
    unmatched.push(f.properties.name);
    continue;
  }
  if (SKIP.has(iso)) continue;
  const list = parts.get(iso) ?? [];
  list.push({ f, bounds: geoBounds(f) as [[number, number], [number, number]] });
  parts.set(iso, list);
}
console.log("not mapped (skipped):", unmatched.join(", "));

const inBounds = (b: Part["bounds"], lon: number, lat: number) => {
  if (lat < b[0][1] || lat > b[1][1]) return false;
  return b[0][0] <= b[1][0] ? lon >= b[0][0] && lon <= b[1][0] : lon >= b[0][0] || lon <= b[1][0]; // wraps the antimeridian
};

// the country at a point, or null for sea
const entries = [...parts.entries()];
function countryAt(lon: number, lat: number): string | null {
  for (const [iso, list] of entries) for (const p of list) if (inBounds(p.bounds, lon, lat) && geoContains(p.f, [lon, lat])) return iso;
  return null;
}

// label point and size: the biggest polygon of the biggest feature of the country
function describe(iso: string) {
  let best: { coords: [number, number]; span: number; area: number } | null = null;
  for (const { f } of parts.get(iso)!) {
    const g = f.geometry as Polygon | MultiPolygon;
    const polys: Polygon[] = g.type === "Polygon" ? [g] : g.coordinates.map((coordinates) => ({ type: "Polygon", coordinates }));
    for (const poly of polys) {
      const area = geoArea({ type: "Feature", properties: {}, geometry: poly });
      if (best && area <= best.area) continue;
      const feat: Feature<Polygon> = { type: "Feature", properties: {}, geometry: poly };
      const [[w, s], [e, n]] = geoBounds(feat);
      const dLon = e >= w ? e - w : e + 360 - w;
      const c = geoCentroid(feat);
      best = { coords: c, span: Math.max(dLon * Math.cos((c[1] * Math.PI) / 180), n - s), area };
    }
  }
  if (!best) throw new Error(`no polygon for ${iso}`);
  return best;
}

const info = new Map(entries.map(([iso]) => [iso, describe(iso)]));
const isos = entries.map(([iso]) => iso).sort();
const index = new Map(isos.map((iso, i) => [iso, i]));

// positions are stored in hundredths of a degree
const round1 = (n: number) => Math.round(n * 100);

// Each lattice is stored as runs: on row i (latitude LAT_MIN + i * step, n = round(360 cos(lat) / step) dots, odd rows shifted by half a
// dot) the dots j0 .. j0 + count - 1 belong to one country. components/globeEngine.ts expands them with the same formula, so a lattice
// of 200,000 candidate points costs a few thousand numbers.
const levels = LEVELS.map(({ step }) => {
  const runs: number[] = []; // row, country, first dot, number of dots
  const owned = isos.map(() => 0);
  let total = 0;
  for (let i = 0, lat = LAT_MIN; lat <= LAT_MAX; i++, lat = LAT_MIN + i * step) {
    const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));
    let run: { owner: number; j0: number; count: number } | null = null;
    const close = () => {
      if (run) runs.push(i, run.owner, run.j0, run.count);
      run = null;
    };
    for (let j = 0; j < n; j++) {
      const lon = -180 + ((j + (i % 2 ? 0.5 : 0)) * 360) / n;
      const iso = countryAt(lon > 180 ? lon - 360 : lon, lat);
      const owner = iso === null ? -1 : index.get(iso)!;
      if (owner < 0) {
        close();
        continue;
      }
      owned[owner]++;
      total++;
      if (run && run.owner === owner) run.count++;
      else {
        close();
        run = { owner, j0: j, count: 1 };
      }
    }
    close();
  }
  // a country too small for the lattice (Malta, Luxembourg, Liechtenstein...) still gets its one dot
  const extras: number[] = [];
  isos.forEach((iso, ci) => {
    if (owned[ci] === 0) extras.push(ci, round1(info.get(iso)!.coords[0]), round1(info.get(iso)!.coords[1]));
  });
  console.log("step", step, "dots:", total, "runs:", runs.length / 4);
  return { step, runs, extras };
});

// Outlines: every arc once (coasts and borders), decimated and delta-encoded in tenths of a degree
const lines = (mesh(topo, topo.objects.countries as GeometryCollection).coordinates as [number, number][][]);
const outlines: number[][] = [];
for (const line of lines) {
  const kept: [number, number][] = [];
  for (let k = 0; k < line.length; k++) {
    const [lon, lat] = line[k];
    if (lat < LAT_MIN) continue;
    const inEurope = lon > -26 && lon < 46 && lat > 32 && lat < 73;
    const tol = inEurope ? 0.035 : 0.2;
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(lon - last[0], lat - last[1]) >= tol || k === line.length - 1) kept.push([lon, lat]);
  }
  if (kept.length < 2) continue;
  const flat = [round1(kept[0][0]), round1(kept[0][1])];
  let px = flat[0];
  let py = flat[1];
  for (let k = 1; k < kept.length; k++) {
    const x = round1(kept[k][0]);
    const y = round1(kept[k][1]);
    flat.push(x - px, y - py);
    px = x;
    py = y;
  }
  outlines.push(flat);
}

const countries = isos.map((iso) => {
  const d = info.get(iso)!;
  const name = String(parts.get(iso)?.[0].f.properties?.name ?? iso);
  return { iso, name, tier: tierOf(iso), lon: Math.round(d.coords[0] * 10) / 10, lat: Math.round(d.coords[1] * 10) / 10, span: Math.round(d.span * 10) / 10 };
});

const json = { latMin: LAT_MIN, countries, levels, outlines };
writeFileSync("lib/geo/world-globe.json", JSON.stringify(json));
console.log("countries:", countries.length, "| outline points:", outlines.reduce((a, l) => a + l.length / 2, 0), "| file KB:", Math.round(JSON.stringify(json).length / 1024));
const eu = [...EU, ...EUROPE, ...NEAR].filter((iso) => !index.has(iso));
console.log("missing european countries:", eu.join(",") || "none");

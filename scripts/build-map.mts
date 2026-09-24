import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoCentroid, geoConicConformal, geoContains, geoGraticule, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

type Tier = "eu" | "europe" | "near";
const NUMERIC: Record<string, [string, Tier]> = {
  "040": ["AT", "eu"], "056": ["BE", "eu"], "100": ["BG", "eu"], "191": ["HR", "eu"], "196": ["CY", "eu"], "203": ["CZ", "eu"],
  "208": ["DK", "eu"], "233": ["EE", "eu"], "246": ["FI", "eu"], "250": ["FR", "eu"], "276": ["DE", "eu"], "300": ["GR", "eu"],
  "348": ["HU", "eu"], "372": ["IE", "eu"], "380": ["IT", "eu"], "428": ["LV", "eu"], "440": ["LT", "eu"], "442": ["LU", "eu"],
  "470": ["MT", "eu"], "528": ["NL", "eu"], "616": ["PL", "eu"], "620": ["PT", "eu"], "642": ["RO", "eu"], "703": ["SK", "eu"],
  "705": ["SI", "eu"], "724": ["ES", "eu"], "752": ["SE", "eu"],
  "826": ["GB", "europe"], "578": ["NO", "europe"], "756": ["CH", "europe"], "352": ["IS", "europe"], "438": ["LI", "europe"],
  "688": ["RS", "europe"], "070": ["BA", "europe"], "008": ["AL", "europe"], "807": ["MK", "europe"], "499": ["ME", "europe"],
  "643": ["RU", "near"], "804": ["UA", "near"], "498": ["MD", "near"], "792": ["TR", "near"], "112": ["BY", "near"],
};

// H reaches far enough south for Malta (~y 385) and Crete; the projection stays anchored to the original 380px frame so nothing else moves.
const W = 440, H = 400, STEP = 5, CY = 196;
const proj = geoConicConformal().parallels([40, 62]).rotate([-14, 0]).center([0, 53]).scale(640).translate([W / 2 + 6, CY]).clipExtent([[0, 0], [W, H]]);
const path = geoPath(proj).digits(1);
const hitPath = geoPath(proj).digits(0);

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8")) as Topology;
const all = feature(topo, topo.objects.countries as GeometryCollection).features as Feature<Geometry, { name: string }>[];

// A label anchor that is always inside the country: the dot with the smallest total distance to all other dots.
function medoid(points: [number, number][]): [number, number] | null {
  let best: [number, number] | null = null;
  let bestSum = Infinity;
  for (const p of points) {
    let sum = 0;
    for (const q of points) sum += Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (sum < bestSum) {
      bestSum = sum;
      best = p;
    }
  }
  return best;
}

const countries = all.flatMap((f) => {
  const meta = f.properties.name === "Kosovo" ? (["XK", "europe"] as [string, Tier]) : NUMERIC[String(f.id).padStart(3, "0")];
  return meta ? [{ f, iso: meta[0], tier: meta[1] }] : [];
});

const out = countries.map(({ f, iso, tier }) => {
  const dots: string[] = [];
  const coords: [number, number][] = [];
  for (let y = STEP / 2; y < H; y += STEP) {
    const row = Math.round(y / STEP);
    for (let x = STEP / 2 + (row % 2 ? STEP / 2 : 0); x < W; x += STEP) {
      const ll = proj.invert?.([x, y]);
      if (!ll || ll[0] < -25 || ll[0] > 45 || ll[1] < 33 || ll[1] > 71.5) continue;
      if (geoContains(f, ll)) {
        dots.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
        coords.push([x, y]);
      }
    }
  }
  const hit = hitPath(f) ?? "";
  const c = medoid(coords) ?? proj(geoCentroid(f));
  return { iso, tier, name: f.properties.name, dots: dots.join(""), dotCount: dots.length, hit, area: path.area(f), label: c ? [Math.round(c[0]), Math.round(c[1])] : null };
}).filter((c) => c.hit);

// Extent is generous on purpose: clipExtent above crops it to the frame, so this just has to reach every corner (lon ~-35..61, lat ~33..64).
const graticule = path(geoGraticule().step([10, 5]).extent([[-42, 25], [66, 78]])()) ?? "";
const json = { w: W, h: H, graticule, countries: out };
writeFileSync("lib/geo/europe-map.json", JSON.stringify(json));
console.log("countries:", out.length, "| file KB:", Math.round(JSON.stringify(json).length / 1024), "| hit KB:", Math.round(out.reduce((a, c) => a + c.hit.length, 0) / 1024), "| dots KB:", Math.round(out.reduce((a, c) => a + c.dots.length, 0) / 1024));
console.log("no dots:", out.filter((c) => c.dotCount === 0).map((c) => c.iso).join(","));

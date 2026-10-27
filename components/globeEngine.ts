import worldJson from "@/lib/geo/world-globe.json";
import type { Scope } from "@/lib/geo";

// Canvas renderer of the globe in the region panel. Orthographic projection written out by hand (a few multiplications per
// dot, no d3 at runtime); the geometry comes from scripts/build-globe.mts. It draws on demand (only while the view is moving
// or something changed), keeps the dot-matrix look of the old flat map, and picks countries by the nearest drawn dot.

type Tier = "eu" | "europe" | "near" | "world";
type Raw = {
  countries: { iso: string; name: string; tier: Tier; lon: number; lat: number; span: number }[];
  latMin: number;
  levels: { step: number; runs: number[]; extras: number[] }[];
  outlines: number[][];
};

const raw = worldJson as unknown as Raw;
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;

export const COUNTRIES = raw.countries;
const INDEX = new Map(COUNTRIES.map((c, i) => [c.iso, i]));

type Trig = { n: number; sinLat: Float32Array; cosLat: Float32Array; sinLon: Float32Array; cosLon: Float32Array };
// Dots are sorted into 6-degree cells, so a frame only looks at the cells that can be on screen (zoomed in that is a few percent of
// the dots). capVec/capRad do the same for outlines: a unit vector and an angular radius that contain a whole line.
type Level = Trig & { step: number; owner: Uint16Array; cellStart: Int32Array; cellVec: Float32Array; cellCount: number };
type Lines = Trig & { starts: Int32Array; capVec?: Float32Array; capRad?: Float32Array };

const CELL = 6;
const CELL_COLS = 360 / CELL;
// half the diagonal of a cell at the equator, with a margin
const CELL_RADIUS = 5 * RAD;

function trig(lons: ArrayLike<number>, lats: ArrayLike<number>): Trig {
  const n = lons.length;
  const t: Trig = { n, sinLat: new Float32Array(n), cosLat: new Float32Array(n), sinLon: new Float32Array(n), cosLon: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    t.sinLat[i] = Math.sin(lats[i] * RAD);
    t.cosLat[i] = Math.cos(lats[i] * RAD);
    t.sinLon[i] = Math.sin(lons[i] * RAD);
    t.cosLon[i] = Math.cos(lons[i] * RAD);
  }
  return t;
}

// A lattice is stored as runs of dots on its rows (see scripts/build-globe.mts): row i sits at latMin + i * step, holds
// n = round(360 cos(lat) / step) dots, and odd rows are shifted by half a dot. A run is [row, country, first dot, count].
const LEVELS: Level[] = raw.levels.map((l) => {
  const lons: number[] = [];
  const lats: number[] = [];
  const owner: number[] = [];
  for (let k = 0; k < l.runs.length; k += 4) {
    const [row, country, first, count] = [l.runs[k], l.runs[k + 1], l.runs[k + 2], l.runs[k + 3]];
    const lat = raw.latMin + row * l.step;
    const n = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / l.step));
    for (let j = first; j < first + count; j++) {
      const lon = -180 + ((j + (row % 2 ? 0.5 : 0)) * 360) / n;
      lons.push(lon > 180 ? lon - 360 : lon);
      lats.push(lat);
      owner.push(country);
    }
  }
  // a country too small for the lattice keeps its one dot
  for (let k = 0; k < l.extras.length; k += 3) {
    owner.push(l.extras[k]);
    lons.push(l.extras[k + 1] / 100);
    lats.push(l.extras[k + 2] / 100);
  }
  const n = lons.length;
  const key = new Int32Array(n);
  for (let i = 0; i < n; i++) key[i] = Math.min(180 / CELL - 1, Math.floor((lats[i] + 90) / CELL)) * CELL_COLS + Math.min(CELL_COLS - 1, Math.floor((lons[i] + 180) / CELL));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => key[a] - key[b]);
  const sorted = { lons: order.map((i) => lons[i]), lats: order.map((i) => lats[i]), owner: order.map((i) => owner[i]) };
  const starts: number[] = [];
  const vec: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k > 0 && key[order[k]] === key[order[k - 1]]) continue;
    starts.push(k);
    const latC = (Math.floor(key[order[k]] / CELL_COLS) + 0.5) * CELL - 90;
    const lonC = ((key[order[k]] % CELL_COLS) + 0.5) * CELL - 180;
    vec.push(Math.cos(latC * RAD) * Math.sin(lonC * RAD), Math.sin(latC * RAD), Math.cos(latC * RAD) * Math.cos(lonC * RAD));
  }
  const cellCount = starts.length;
  starts.push(n);
  return { ...trig(sorted.lons, sorted.lats), step: l.step, owner: Uint16Array.from(sorted.owner), cellStart: Int32Array.from(starts), cellVec: Float32Array.from(vec), cellCount };
});

function lines(paths: { lons: number[]; lats: number[] }[]): Lines {
  const lons: number[] = [];
  const lats: number[] = [];
  const starts = [0];
  for (const p of paths) {
    lons.push(...p.lons);
    lats.push(...p.lats);
    starts.push(lons.length);
  }
  const t = trig(lons, lats);
  const capVec = new Float32Array(3 * paths.length);
  const capRad = new Float32Array(paths.length);
  paths.forEach((_, li) => {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = starts[li]; i < starts[li + 1]; i++) {
      x += t.cosLat[i] * t.sinLon[i];
      y += t.sinLat[i];
      z += t.cosLat[i] * t.cosLon[i];
    }
    const len = Math.hypot(x, y, z) || 1;
    x /= len;
    y /= len;
    z /= len;
    let rad = 0;
    for (let i = starts[li]; i < starts[li + 1]; i++) {
      const dot = x * t.cosLat[i] * t.sinLon[i] + y * t.sinLat[i] + z * t.cosLat[i] * t.cosLon[i];
      rad = Math.max(rad, Math.acos(Math.min(1, Math.max(-1, dot))));
    }
    capVec.set([x, y, z], 3 * li);
    capRad[li] = len < 1e-3 ? Math.PI : rad;
  });
  return { ...t, starts: Int32Array.from(starts), capVec, capRad };
}

const OUTLINES = lines(
  raw.outlines.map((flat) => {
    const lons = [flat[0] / 100];
    const lats = [flat[1] / 100];
    let x = flat[0];
    let y = flat[1];
    for (let k = 2; k < flat.length; k += 2) {
      x += flat[k];
      y += flat[k + 1];
      lons.push(x / 100);
      lats.push(y / 100);
    }
    return { lons, lats };
  }),
);

const GRATICULE = (() => {
  const paths: { lons: number[]; lats: number[] }[] = [];
  for (let lat = -60; lat <= 75; lat += 15) {
    const p = { lons: [] as number[], lats: [] as number[] };
    for (let lon = -180; lon <= 180; lon += 4) {
      p.lons.push(lon);
      p.lats.push(lat);
    }
    paths.push(p);
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const p = { lons: [] as number[], lats: [] as number[] };
    for (let lat = -80; lat <= 85; lat += 4) {
      p.lons.push(lon);
      p.lats.push(lat);
    }
    paths.push(p);
  }
  const g = lines(paths);
  return { ...g, capVec: undefined, capRad: undefined } as Lines;
})();

export type View = { lon: number; lat: number; zoom: number };

const MIN_ZOOM = 0.9;
const MAX_ZOOM = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Where the globe looks: over Europe by default (a little closer when only Europe is lit), at a selected country when there is one
export function viewFor(iso: string | null, scope: Scope): View {
  const i = iso === null ? undefined : INDEX.get(iso);
  if (i !== undefined) {
    const c = COUNTRIES[i];
    return { lon: c.lon, lat: clamp(c.lat, -70, 75), zoom: clamp(72 / Math.max(c.span, 6), 1.4, 3.6) };
  }
  // Europe and EU: two zoom steps (1.4 x 1.4) closer than the old 1.3, so Europe fills the frame
  return { lon: 12, lat: 50, zoom: scope === "all" ? 1 : 2.55 };
}

// EU only lights the 27 members, Europe adds the rest of the EEA, UK, Switzerland and the Balkans (Russia, Turkey, Ukraine,
// Belarus and Moldova stay grey), Global lights everything (each country then shows whether it has openings)
function isLit(tier: Tier, scope: Scope): boolean {
  if (scope === "eu") return tier === "eu";
  if (scope === "europe") return tier === "eu" || tier === "europe";
  return true;
}

export type GlobeState = { scope: Scope; counts: Record<string, number>; active: ReadonlySet<string>; hovered: string | null };
export type GlobeHandlers = { onHover: (iso: string | null) => void; onToggle: (iso: string) => void };

type Colors = Record<"near" | "europe" | "eu" | "selected" | "hover" | "grat" | "border" | "ticker" | "outline" | "sphere" | "limb", string>;

function readColors(el: Element): Colors {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    near: v("--map-near", "rgba(51,255,153,.18)"),
    europe: v("--map-europe", "#33ff99"),
    eu: v("--map-eu", "#33ff99"),
    selected: v("--map-selected", "#fff"),
    hover: v("--map-hover", "#fff"),
    grat: v("--map-grat", "rgba(51,255,153,.16)"),
    border: v("--map-border", "rgba(51,255,153,.28)"),
    ticker: v("--map-ticker", "#fff"),
    outline: v("--map-ticker-outline", "none"),
    sphere: v("--map-ui-faint", "rgba(51,255,153,.1)"),
    limb: v("--map-ui-line", "rgba(51,255,153,.3)"),
  };
}

type Paint = { color: keyof Colors; alpha: number; scale: number };
// drawn in this order, so the highlighted countries end up on top
const PAINTS: Paint[] = [
  { color: "near", alpha: 1, scale: 1 },
  { color: "near", alpha: 0.41, scale: 1 },
  { color: "europe", alpha: 1, scale: 1 },
  { color: "europe", alpha: 0.41, scale: 1 },
  { color: "eu", alpha: 1, scale: 1 },
  { color: "eu", alpha: 0.41, scale: 1 },
  { color: "hover", alpha: 1, scale: 1.1 },
  { color: "selected", alpha: 1, scale: 1.25 },
];

// Three lattices over the whole globe, chosen by pixels per degree at the centre of the view: the coarse one carries the whole globe,
// the fine one fades in from FINE_FROM and the finest one takes over from ULTRA_FROM, so borders and codes read wherever you zoom in
const FINE_FROM = 2.7;
const FINE_TO = 3.6;
const ULTRA_FROM = 5.5;
const ULTRA_TO = 7.5;
const COARSE = 0;
const FINE = 1;
const ULTRA = 2;
const TICKER_ALSO = new Set(["NL", "BE", "LU", "CH", "AT"]);

type Scratch = { x: Float32Array; y: Float32Array; r: Float32Array; p: Uint8Array; c: Uint16Array; n: number };
const scratch = (): Scratch[] =>
  LEVELS.map((l) => ({
    x: new Float32Array(l.n),
    y: new Float32Array(l.n),
    r: new Float32Array(l.n),
    p: new Uint8Array(l.n),
    c: new Uint16Array(l.n),
    n: 0,
  }));

export type Globe = {
  setState: (s: GlobeState) => void;
  flyTo: (v: View) => void;
  zoomBy: (factor: number) => void;
  destroy: () => void;
};

export function createGlobe(canvas: HTMLCanvasElement, handlers: () => GlobeHandlers): Globe {
  const ctx = canvas.getContext("2d");
  const noop: Globe = { setState() {}, flyTo() {}, zoomBy() {}, destroy() {} };
  if (!ctx) return noop;
  const context: CanvasRenderingContext2D = ctx;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const view: View = { ...viewFor(null, "europe") };
  const target: View = { ...view };
  let state: GlobeState = { scope: "europe", counts: {}, active: new Set(), hovered: null };
  let paintOf = new Uint8Array(COUNTRIES.length);
  let colors = readColors(document.documentElement);
  let fontFamily = getComputedStyle(canvas).fontFamily;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  const bufs = scratch();
  // what the last frame drew, for picking: the lattice that carried the globe and its spacing on screen
  let pickLevel = COARSE;
  let pickSpacing = 6;

  const clickable = (ci: number) => {
    const c = COUNTRIES[ci];
    return state.active.has(c.iso) || isLit(c.tier, state.scope) || (state.counts[c.iso] ?? 0) > 0;
  };

  function classify() {
    paintOf = new Uint8Array(COUNTRIES.length);
    COUNTRIES.forEach((c, i) => {
      const active = state.active.has(c.iso);
      if (active) return void (paintOf[i] = 7);
      if (state.hovered === c.iso) return void (paintOf[i] = 6);
      const lit = isLit(c.tier, state.scope);
      const base = !lit ? 0 : c.tier === "eu" ? 4 : 2;
      paintOf[i] = base + ((state.counts[c.iso] ?? 0) === 0 ? 1 : 0);
    });
  }

  const geometry = () => {
    const half = Math.min(w, h) / 2;
    const R = half * 0.94 * view.zoom;
    return { cx: w / 2, cy: h / 2, R, ppd: (R * RAD) };
  };

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(64, last ? now - last : 16);
    last = now;
    const moving = step(dt);
    draw();
    if (moving) schedule();
    else last = 0;
  }

  // true while the view is still on its way to the target
  function step(dt: number): boolean {
    const dLon = ((target.lon - view.lon + 540) % 360) - 180;
    const dLat = target.lat - view.lat;
    const dZoom = target.zoom - view.zoom;
    if (reduced.matches || (Math.abs(dLon) < 0.02 && Math.abs(dLat) < 0.02 && Math.abs(dZoom) < 0.002)) {
      view.lon = target.lon;
      view.lat = target.lat;
      view.zoom = target.zoom;
      return false;
    }
    const k = 1 - Math.exp(-dt / 170);
    view.lon = ((view.lon + dLon * k + 540) % 360) - 180;
    view.lat += dLat * k;
    view.zoom += dZoom * k;
    return true;
  }

  function projection() {
    const lon0 = view.lon * RAD;
    const lat0 = view.lat * RAD;
    return { s0: Math.sin(lat0), c0: Math.cos(lat0), sl0: Math.sin(lon0), cl0: Math.cos(lon0) };
  }
  type P = ReturnType<typeof projection>;

  function strokeLines(l: Lines, p: P, cx: number, cy: number, R: number, color: string, width: number, thetaMax: number) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    const v0x = p.c0 * p.sl0;
    const v0y = p.s0;
    const v0z = p.c0 * p.cl0;
    for (let li = 0; li < l.starts.length - 1; li++) {
      if (l.capVec && l.capRad) {
        const reach = Math.cos(Math.min(Math.PI, thetaMax + l.capRad[li]));
        if (l.capVec[3 * li] * v0x + l.capVec[3 * li + 1] * v0y + l.capVec[3 * li + 2] * v0z < reach) continue;
      }
      let pen = false;
      for (let i = l.starts[li]; i < l.starts[li + 1]; i++) {
        const cd = l.cosLon[i] * p.cl0 + l.sinLon[i] * p.sl0;
        if (p.s0 * l.sinLat[i] + p.c0 * l.cosLat[i] * cd <= 0) {
          pen = false;
          continue;
        }
        const sd = l.sinLon[i] * p.cl0 - l.cosLon[i] * p.sl0;
        const x = cx + R * l.cosLat[i] * sd;
        const y = cy - R * (p.c0 * l.sinLat[i] - p.s0 * l.cosLat[i] * cd);
        if (pen) context.lineTo(x, y);
        else {
          context.moveTo(x, y);
          pen = true;
        }
      }
    }
    context.stroke();
  }

  function dots(li: number, p: P, cx: number, cy: number, R: number, ppd: number, alpha: number, thetaMax: number) {
    const L = LEVELS[li];
    const S = bufs[li];
    const rBase = clamp(L.step * ppd * 0.3, 0.8, 3.2);
    let n = 0;
    const reach = Math.cos(Math.min(Math.PI, thetaMax + CELL_RADIUS));
    const v0x = p.c0 * p.sl0;
    const v0y = p.s0;
    const v0z = p.c0 * p.cl0;
    for (let m = 0; m < L.cellCount; m++) {
      // a cell that cannot reach the screen costs one dot product, not its dots
      if (L.cellVec[3 * m] * v0x + L.cellVec[3 * m + 1] * v0y + L.cellVec[3 * m + 2] * v0z < reach) continue;
      for (let i = L.cellStart[m]; i < L.cellStart[m + 1]; i++) {
        const cd = L.cosLon[i] * p.cl0 + L.sinLon[i] * p.sl0;
        const cosc = p.s0 * L.sinLat[i] + p.c0 * L.cosLat[i] * cd;
        if (cosc <= 0.02) continue;
        const sd = L.sinLon[i] * p.cl0 - L.cosLon[i] * p.sl0;
        S.x[n] = cx + R * L.cosLat[i] * sd;
        S.y[n] = cy - R * (p.c0 * L.sinLat[i] - p.s0 * L.cosLat[i] * cd);
        S.r[n] = rBase * (0.55 + 0.45 * Math.sqrt(cosc));
        S.c[n] = L.owner[i];
        S.p[n] = paintOf[L.owner[i]];
        n++;
      }
    }
    S.n = n;
    for (let k = 0; k < PAINTS.length; k++) {
      const paint = PAINTS[k];
      context.globalAlpha = alpha * paint.alpha;
      context.fillStyle = colors[paint.color];
      context.beginPath();
      let any = false;
      for (let j = 0; j < n; j++) {
        if (S.p[j] !== k) continue;
        const r = S.r[j] * paint.scale;
        context.moveTo(S.x[j] + r, S.y[j]);
        context.arc(S.x[j], S.y[j], r, 0, TAU);
        any = true;
      }
      if (any) context.fill();
    }
    context.globalAlpha = 1;
  }

  function tickers(p: P, cx: number, cy: number, R: number, ppd: number) {
    const placed: [number, number][] = [];
    const order = COUNTRIES.map((c, i) => i).sort((a, b) => COUNTRIES[b].span - COUNTRIES[a].span);
    // bigger when zoomed in, where there is room for it
    const size = clamp(9 + ppd * 0.35, 10, 14);
    const boxW = 2.4 * size;
    context.font = `700 ${size}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    for (const i of order) {
      const c = COUNTRIES[i];
      const on = state.active.has(c.iso);
      const lit = on || isLit(c.tier, state.scope);
      // far out only the countries of the current scope carry a code, otherwise the whole world reads as clutter; zoomed in every
      // country does (dimmer when it is out of scope) and the small ones get theirs too
      if (!lit && !(ppd >= 5 && c.span * ppd > 22)) continue;
      const wide = c.span * ppd > 18;
      if (!wide && !(TICKER_ALSO.has(c.iso) && ppd >= 3) && !(lit && ppd >= 6)) continue;
      const lat = c.lat * RAD;
      const lon = c.lon * RAD;
      const cd = Math.cos(lon) * p.cl0 + Math.sin(lon) * p.sl0;
      const cosc = p.s0 * Math.sin(lat) + p.c0 * Math.cos(lat) * cd;
      if (cosc < 0.3) continue;
      const x = cx + R * Math.cos(lat) * (Math.sin(lon) * p.cl0 - Math.cos(lon) * p.sl0);
      const y = cy - R * (p.c0 * Math.sin(lat) - p.s0 * Math.cos(lat) * cd);
      if (placed.some(([px, py]) => Math.abs(px - x) < boxW && Math.abs(py - y) < size + 3)) continue;
      placed.push([x, y]);
      context.globalAlpha = on ? 1 : lit ? 0.85 : 0.45;
      if (colors.outline !== "none") {
        context.strokeStyle = colors.outline;
        context.strokeText(c.iso, x, y);
      }
      context.fillStyle = colors.ticker;
      context.fillText(c.iso, x, y);
    }
    context.globalAlpha = 1;
  }

  function draw() {
    if (w === 0 || h === 0) return;
    const { cx, cy, R, ppd } = geometry();
    const p = projection();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, w, h);

    context.beginPath();
    context.arc(cx, cy, R, 0, TAU);
    context.fillStyle = colors.sphere;
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = colors.limb;
    context.stroke();

    // how far from the centre of the view (as an angle on the globe) anything can still be on screen
    const reachPx = Math.hypot(w / 2, h / 2);
    const thetaMax = reachPx >= R ? Math.PI / 2 : Math.asin(reachPx / R);

    strokeLines(GRATICULE, p, cx, cy, R, colors.grat, 0.7, thetaMax);
    // borders: faint over the whole globe, firmer and thicker once zoomed in, where they are what tells the countries apart
    const near = clamp((ppd - 3) / 6, 0, 1);
    if (near > 0) {
      context.globalAlpha = 0.3 + 0.55 * near;
      strokeLines(OUTLINES, p, cx, cy, R, colors.europe, 0.6 + 0.9 * near, thetaMax);
      context.globalAlpha = 1;
    } else {
      strokeLines(OUTLINES, p, cx, cy, R, colors.border, 0.6, thetaMax);
    }

    const fine = clamp((ppd - FINE_FROM) / (FINE_TO - FINE_FROM), 0, 1);
    const ultra = clamp((ppd - ULTRA_FROM) / (ULTRA_TO - ULTRA_FROM), 0, 1);
    if (fine < 1) dots(COARSE, p, cx, cy, R, ppd, 1 - fine, thetaMax);
    if (fine > 0) dots(FINE, p, cx, cy, R, ppd, fine * (1 - ultra), thetaMax);
    if (ultra > 0) dots(ULTRA, p, cx, cy, R, ppd, ultra, thetaMax);
    // the lattice that carries the picture is the one the pointer is matched against
    pickLevel = ultra >= 0.5 ? ULTRA : fine >= 0.5 ? FINE : COARSE;
    pickSpacing = LEVELS[pickLevel].step * ppd;

    tickers(p, cx, cy, R, ppd);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    fontFamily = getComputedStyle(canvas).fontFamily;
    schedule();
  }

  // The country whose nearest drawn dot is within reach of the pointer
  function pick(px: number, py: number): number | null {
    const S = bufs[pickLevel];
    const reach = Math.max(pickSpacing * 0.8, 5);
    let best = reach * reach;
    let found: number | null = null;
    for (let j = 0; j < S.n; j++) {
      const dx = S.x[j] - px;
      const dy = S.y[j] - py;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        found = S.c[j];
      }
    }
    return found !== null && clickable(found) ? found : null;
  }

  // ---- pointer: drag rotates, a click without movement picks a country ----
  let drag: { x: number; y: number; lon: number; lat: number; moved: boolean } | null = null;
  let hoverIso: string | null = null;
  let hoverFrame = 0;
  let hoverAt: [number, number] | null = null;

  const local = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function setHover(iso: string | null) {
    canvas.style.cursor = drag?.moved ? "grabbing" : iso ? "pointer" : "grab";
    if (iso === hoverIso) return;
    hoverIso = iso;
    handlers().onHover(iso);
  }

  function onDown(e: PointerEvent) {
    const [x, y] = local(e);
    drag = { x, y, lon: view.lon, lat: view.lat, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    const [x, y] = local(e);
    if (drag) {
      const dx = x - drag.x;
      const dy = y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        setHover(null);
        canvas.style.cursor = "grabbing";
      }
      if (drag.moved) {
        const { ppd } = geometry();
        view.lon = (((drag.lon - dx / ppd + 540) % 360) + 360) % 360 - 180;
        view.lat = clamp(drag.lat + dy / ppd, -80, 80);
        target.lon = view.lon;
        target.lat = view.lat;
        target.zoom = view.zoom;
        schedule();
      }
      return;
    }
    hoverAt = [x, y];
    if (!hoverFrame)
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        if (!hoverAt || drag) return;
        const ci = pick(hoverAt[0], hoverAt[1]);
        setHover(ci === null ? null : COUNTRIES[ci].iso);
      });
  }

  function onUp(e: PointerEvent) {
    const wasDrag = drag;
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (wasDrag && !wasDrag.moved) {
      const [x, y] = local(e);
      const ci = pick(x, y);
      if (ci !== null) handlers().onToggle(COUNTRIES[ci].iso);
    }
    canvas.style.cursor = hoverIso ? "pointer" : "grab";
  }

  function onLeave() {
    hoverAt = null;
    if (!drag) setHover(null);
  }

  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const themeObserver = new MutationObserver(() => {
    colors = readColors(document.documentElement);
    schedule();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  resize();

  return {
    setState(next) {
      state = next;
      classify();
      schedule();
    },
    flyTo(v) {
      target.lon = v.lon;
      target.lat = v.lat;
      target.zoom = v.zoom;
      schedule();
    },
    zoomBy(factor) {
      target.zoom = clamp(target.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      schedule();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    },
  };
}

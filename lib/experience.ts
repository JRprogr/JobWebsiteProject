export type Experience = { min: number; max: number | null; kind: "explicit" | "estimated" };

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b(?=\\s*\\+?\\s*[- ]?(?:years?|yrs?)\\b)`, "gi");

const UNIT = "(?:years?|yrs?|jahre?n?|ans|années|años)";
const RANGE_RE = new RegExp(`(\\d{1,2})\\s*(?:-|–|—|to|bis|à|und|or)\\s*(\\d{1,2})\\s*\\+?\\s*[- ]?${UNIT}\\b`, "gi");
const SINGLE_RE = new RegExp(
  `(?:(at least|minimum(?: of)?|min\\.?|mindestens|au moins|over|more than|>)\\s*)?(\\d{1,2})\\s*(\\+)?\\s*[- ]?${UNIT}\\b`,
  "gi",
);

// A year figure only counts when it sits next to talk of experience, so "founded 15 years ago" is ignored.
const CONTEXT_RE = /experience|erfahrung|expérience|experiencia|background|track record|professional|proven|practical|working (?:in|with|as)|berufs/i;
const NOISE_AFTER_RE = /^\W{0,3}(?:ago|old|of age|alt\b|d['’]âge|since|in the|on the market)/i;
const NOISE_BEFORE_RE = /(?:last|past|previous|next|within|over the|for the last|founded|since|in the past)\s*$/i;

const PREFERRED_RE = /preferred|nice to have|nice-to-have|bonus|desirable|a plus\b|wünschenswert|von vorteil|idealerweise|souhaité|appreciated/gi;
const REQUIRED_RE = /basic qualifications?|minimum qualifications?|required qualifications?|requirements?|must have|must-have|you have|you bring|what you.ll need|mindestens|voraussetzungen|ihr profil|anforderungen|profil recherché/gi;

// True when the nearest section cue before this position marks it as "preferred" rather than required
function inPreferredSection(body: string, index: number): boolean {
  const before = body.slice(Math.max(0, index - 500), index);
  const last = (re: RegExp) => [...before.matchAll(re)].at(-1)?.index ?? -1;
  return last(PREFERRED_RE) > last(REQUIRED_RE);
}

const STUDENT_TITLE_RE = /\b(?:intern(?:ship)?|praktik(?:um|ant|antin)|werkstudent(?:in)?|working student|thesis|abschlussarbeit|masterarbeit|bachelorarbeit|diplomarbeit|stagiaire|apprentice(?:ship)?|ausbildung|azubi|student(?:in)?|studentische|aushilfe|hiwi|co-?op)\b|^\s*stage\b/i;
const ENTRY_TEXT_RE = /\b(?:entry[- ]level|no (?:prior |previous )?(?:work )?experience (?:is )?(?:required|needed|necessary)|recent graduates?|new grads?|fresh graduates?|berufseinsteiger(?:in)?|absolvent(?:en|in)?|sans expérience|débutants? accepté)/i;
const SEVERAL_RE = /\b(?:several|multiple|a few|mehrjährige[rn]?|plusieurs) (?:years|jahre|années)|\bmehrjährige[rn]?\b|\bplusieurs années\b/i;
const MANY_RE = /\b(?:many years|extensive (?:professional |industry )?experience|jahrelange[rn]?|années d['’]expérience significative|decades of)\b/i;

function fromTitle(title: string): Experience | null {
  if (STUDENT_TITLE_RE.test(title)) return { min: 0, max: 0, kind: "estimated" };
  if (/\bjunior\b|\bjr\.?\b|\bgraduate\b/i.test(title)) return { min: 0, max: 2, kind: "estimated" };
  if (/\b(?:director|head of|vp|vice president|chief)\b/i.test(title)) return { min: 10, max: null, kind: "estimated" };
  if (/\b(?:principal|staff|distinguished|fellow)\b/i.test(title)) return { min: 8, max: null, kind: "estimated" };
  if (/\b(?:senior|sr\.?|lead|leitende[rn]?)\b/i.test(title)) return { min: 5, max: null, kind: "estimated" };
  return null;
}

export function extractExperience(text: string | null, title: string): Experience | null {
  if (text) {
    const body = text.replace(WORD_RE, (w) => String(WORDS[w.toLowerCase()]));
    let best: Experience | null = null;
    let bestPreferred: Experience | null = null;
    const consider = (min: number, max: number | null, index: number, length: number) => {
      if (min > 25 || (max !== null && (max > 30 || max < min))) return;
      const window = body.slice(Math.max(0, index - 110), index + length + 110);
      if (!CONTEXT_RE.test(window)) return;
      if (NOISE_AFTER_RE.test(body.slice(index + length, index + length + 16))) return;
      if (NOISE_BEFORE_RE.test(body.slice(Math.max(0, index - 20), index))) return;
      if (inPreferredSection(body, index)) {
        if (!bestPreferred || min > bestPreferred.min) bestPreferred = { min, max, kind: "estimated" };
      } else if (!best || min > best.min) best = { min, max, kind: "explicit" };
    };

    const rangeSpans: [number, number][] = [];
    for (const m of body.matchAll(RANGE_RE)) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      rangeSpans.push([m.index, m.index + m[0].length]);
      consider(a, b, m.index, m[0].length);
    }
    for (const m of body.matchAll(SINGLE_RE)) {
      if (rangeSpans.some(([s, e]) => m.index >= s && m.index < e)) continue;
      consider(Number(m[2]), null, m.index, m[0].length);
    }
    if (best) return best;
    if (bestPreferred) return bestPreferred;

    if (STUDENT_TITLE_RE.test(title) || ENTRY_TEXT_RE.test(body)) return { min: 0, max: 0, kind: "estimated" };
    if (MANY_RE.test(body)) return { min: 8, max: null, kind: "estimated" };
    if (SEVERAL_RE.test(body)) return { min: 5, max: null, kind: "estimated" };
  }
  return fromTitle(title);
}

export const EXPERIENCE_BUCKETS = {
  entry: { label: "ENTRY · 0–2 YRS", lo: 0, hi: 2 },
  mid: { label: "MID · 3–5 YRS", lo: 3, hi: 5 },
  senior: { label: "SENIOR · 6+ YRS", lo: 6, hi: 99 },
} as const;

export type ExperienceBucket = keyof typeof EXPERIENCE_BUCKETS;

export function parseBucket(value: string | undefined): ExperienceBucket | null {
  return value !== undefined && value in EXPERIENCE_BUCKETS ? (value as ExperienceBucket) : null;
}

export function formatExperience(min: number | null, max: number | null, kind: string | null): string | null {
  if (min === null) return null;
  const range = max === null ? `${min}+` : max === min ? `${min}` : `${min}–${max}`;
  return `${kind === "estimated" ? "~" : ""}${range} YRS`;
}

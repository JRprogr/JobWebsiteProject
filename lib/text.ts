const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", bull: "•", middot: "·", copy: "©", reg: "®", euro: "€", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä",
  Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
};

// Accented Latin letters by entity suffix ("&acirc;" = a + circ): letters in order, lower case then upper case
const ACCENTED: [string, string, string][] = [
  ["acute", "aeiouy", "áéíóúý"], ["grave", "aeiou", "àèìòù"], ["circ", "aeiou", "âêîôû"], ["uml", "aeiouy", "äëïöüÿ"],
  ["tilde", "ano", "ãñõ"], ["ring", "a", "å"], ["cedil", "c", "ç"], ["slash", "o", "ø"],
];
for (const [suffix, letters, glyphs] of ACCENTED) {
  [...letters].forEach((letter, i) => {
    NAMED[letter + suffix] ??= glyphs[i];
    NAMED[letter.toUpperCase() + suffix] ??= glyphs[i].toUpperCase();
  });
}
Object.assign(NAMED, { aelig: "æ", AElig: "Æ", oelig: "œ", OElig: "Œ", laquo: "«", raquo: "»", sect: "§", deg: "°", plusmn: "±", times: "×", trade: "™", bdquo: "„", sbquo: "‚", thinsp: " ", ensp: " ", emsp: " " });

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? whole;
  });
}

export const MAX_DETAIL_CHARS = 20_000;

// Turns HTML into readable plain text (paragraph breaks kept); never returns markup.
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|ul|ol|section)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n{2,}(?=• )/g, "\n")
    .trim()
    .slice(0, MAX_DETAIL_CHARS);
}

// Returns the outer HTML of the first element whose opening tag contains `marker`, balancing nested tags of the same name.
export function extractElement(html: string, marker: string): string | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.lastIndexOf("<", at);
  const name = html.slice(start + 1).match(/^[a-z0-9]+/i)?.[0];
  if (!name) return null;
  const tag = new RegExp(`<(/?)${name}(?=[\\s>/])`, "gi");
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      const end = html.indexOf(">", m.index);
      return html.slice(start, end + 1);
    }
  }
  return null;
}

// Some ATS description fields arrive polluted with the vendor widget's own stylesheet (".wm-ab-launcher-spinner { ... }", "@keyframes ...");
// drop CSS rule blocks so only the words remain
export function stripCss(text: string): string {
  return text
    .replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, " ")
    .replace(/[.#][\w:>. #-]+\{[^{}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

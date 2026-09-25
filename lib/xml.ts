import { decodeEntities } from "./text.ts";

// Minimal tolerant XML helpers for the flat feeds we read (Personio, Teamtailor); not a general parser.
const open = (tag: string) => `<${tag}(?:\\s[^>]*)?>`;

// Inner XML of every <tag>…</tag> (tags of the same name must not nest)
export function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`${open(tag)}([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}

// Text of the first <tag>, with CDATA unwrapped (HTML inside stays as HTML) and entities decoded otherwise
export function tagText(xml: string, tag: string): string | null {
  const inner = blocks(xml, tag)[0]?.trim();
  if (inner === undefined) return null;
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  return (cdata ? cdata[1] : decodeEntities(inner)).trim() || null;
}

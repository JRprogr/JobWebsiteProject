import { extractText, getDocumentProxy } from "unpdf";
import { MAX_DETAIL_CHARS } from "./text.ts";

// Plain text of a job description that a company publishes as a PDF (Neuraspace, Blackswan Space)
export async function pdfText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; DSCareersBot/0.1; portfolio project)" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean ? clean.slice(0, MAX_DETAIL_CHARS) : null;
}

import links from "../db/seed/links.json" with { type: "json" };
import { sql } from "./db.ts";

export type LinkRow = {
  from: string; // a register slug, or the name of a company that is not on the board
  to: string;
  kind: "ownership" | "joint_venture" | "contract" | "partnership";
  year?: number;
  note?: string;
  source_url?: string;
  from_type?: "company" | "agency" | "buyer"; // the kind of an end that is not on the board
  to_type?: "company" | "agency" | "buyer";
};

// Register companies by slug -> id, so a link end can be either a slug or a plain name
export async function companyIds(): Promise<Map<string, string>> {
  const rows = await sql().query("select slug, id from companies");
  return new Map(rows.map((r) => [String(r.slug), String(r.id)]));
}

// `end` -> [company id, name]: exactly one of them is set
export const resolveEnd = (ids: Map<string, string>, end: string): [string | null, string | null] => {
  const id = ids.get(end);
  return id ? [id, null] : [null, end];
};

// db/seed/links.json is the source of truth for the curated links: rows that are no longer in the file are removed
export async function syncCuratedLinks(): Promise<number> {
  const db = sql();
  const ids = await companyIds();
  const rows = links as LinkRow[];
  await db.transaction([
    db.query("delete from company_links where origin = 'curated'"),
    ...rows.map((l) => {
      const [fc, fn] = resolveEnd(ids, l.from);
      const [tc, tn] = resolveEnd(ids, l.to);
      return db.query(
        `insert into company_links (from_company, from_name, to_company, to_name, kind, origin, year, note, source_url, from_type, to_type)
         values ($1, $2, $3, $4, $5, 'curated', $6, $7, $8, $9, $10)`,
        [fc, fn, tc, tn, l.kind, l.year ?? null, l.note ?? null, l.source_url ?? null, fn ? (l.from_type ?? null) : null, tn ? (l.to_type ?? null) : null],
      );
    }),
  ]);
  return rows.length;
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "../lib/db.ts";

const dir = join(import.meta.dirname, "..", "db", "migrations");
const db = sql();

await db.query(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
);
const applied = new Set(
  (await db.query("select name from _migrations")).map((r) => r.name as string),
);

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) {
    console.log(`skip   ${file}`);
    continue;
  }
  const statements = readFileSync(join(dir, file), "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.transaction([
    ...statements.map((s) => db.query(s)),
    db.query("insert into _migrations (name) values ($1)", [file]),
  ]);
  console.log(`apply  ${file} (${statements.length} statements)`);
}

const tables = await db.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by 1",
);
console.log("tables:", tables.map((t) => t.table_name).join(", "));

import companies from "../db/seed/companies.json" with { type: "json" };
import { sql } from "../lib/db.ts";

const db = sql();
for (const c of companies) {
  await db.query(
    `insert into companies (name, slug, sector, source_type, source_config, active)
     values ($1, $2, $3, $4, $5::jsonb, $6)
     on conflict (slug) do update set name = excluded.name, sector = excluded.sector, source_type = excluded.source_type,
       source_config = excluded.source_config, active = excluded.active`,
    [c.name, c.slug, c.sector, c.source_type, JSON.stringify(c.source_config), c.active],
  );
  console.log(`seeded ${c.slug} (${c.source_type}${c.active ? "" : ", inactive"})`);
}

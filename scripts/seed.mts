import companies from "../db/seed/companies.json" with { type: "json" };
import { sql } from "../lib/db.ts";

const db = sql();
for (const c of companies) {
  await db.query(
    `insert into companies (name, slug, classification, source_type, source_config, active, careers_url, hq_country, logo_url)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     on conflict (slug) do update set name = excluded.name, classification = excluded.classification, source_type = excluded.source_type,
       source_config = excluded.source_config, active = excluded.active,
       careers_url = excluded.careers_url, hq_country = excluded.hq_country, logo_url = excluded.logo_url`,
    [c.name, c.slug, c.classification, c.source_type, JSON.stringify(c.source_config), c.active, c.careers_url ?? null, c.hq_country ?? null, c.logo_url ?? null],
  );
  console.log(`seeded ${c.slug} (${c.source_type}${c.active ? "" : ", inactive"})`);
}

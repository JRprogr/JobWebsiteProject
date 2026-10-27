-- Links between companies for the Market Insight page: ownership / acquisitions, joint ventures, contracts and partnerships.
-- Each end is either a register company (from_company / to_company) or a company that is not on the board (from_name / to_name).
-- Direction: parent -> subsidiary, partner -> joint venture, customer or prime contractor -> supplier or subcontractor.
-- Rows come from db/seed/links.json (origin 'curated', synced on every deploy) and from `npm run links` (origin 'usaspending').
create table if not exists company_links (
  id uuid primary key default gen_random_uuid(),
  from_company uuid references companies(id) on delete cascade,
  from_name text,
  to_company uuid references companies(id) on delete cascade,
  to_name text,
  kind text not null,
  origin text not null,
  year int,
  weight int not null default 1,
  amount_usd bigint,
  first_date date,
  last_date date,
  source_url text,
  note text,
  updated_at timestamptz not null default now(),
  check ((from_company is null) <> (from_name is null)),
  check ((to_company is null) <> (to_name is null))
);

create unique index if not exists company_links_edge_idx on company_links (coalesce(from_company::text, from_name), coalesce(to_company::text, to_name), kind, origin);

create index if not exists company_links_from_idx on company_links (from_company);

create index if not exists company_links_to_idx on company_links (to_company)

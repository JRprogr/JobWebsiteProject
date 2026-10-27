-- Links read from TED (EU public procurement) carry the buyer's currency, and an outside end can be a public buyer or agency rather than a company
alter table company_links add column if not exists currency text;

alter table company_links add column if not exists from_type text;

alter table company_links add column if not exists to_type text

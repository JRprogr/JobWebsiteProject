-- Language of the listing text (ISO 639-1, from lib/language.ts) and a coarse role type (from lib/roles.ts), both filled by the
-- scraper. Existing rows get theirs from `npm run scrape -- --reextract` (workflow dispatch option "reextract").
alter table jobs add column if not exists language text;

alter table jobs add column if not exists role_type text;

create index if not exists jobs_language_idx on jobs (language) where removed_at is null and language is not null;

create index if not exists jobs_role_type_idx on jobs (role_type) where removed_at is null and role_type is not null

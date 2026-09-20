alter table jobs add column if not exists location_countries text[] not null default '{}';

create index if not exists jobs_countries_idx on jobs using gin (location_countries) where removed_at is null

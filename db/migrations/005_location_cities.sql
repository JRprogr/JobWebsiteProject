alter table jobs add column if not exists location_cities text[] not null default '{}'

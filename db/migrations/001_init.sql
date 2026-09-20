create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  logo_url      text,
  sector        text,
  source_type   text not null,
  source_config jsonb not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists jobs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id),
  external_id        text not null,
  title              text not null,
  location_raw       text,
  location_country   text,
  location_region    text,
  location_city      text,
  remote             boolean not null default false,
  department         text,
  url                text not null,
  salary_min         int,
  salary_max         int,
  salary_currency    text,
  posted_at          timestamptz,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  removed_at         timestamptz,
  source_type        text not null,
  tags               text[] not null default '{}',
  unique (company_id, external_id)
);

create table if not exists scrape_runs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text check (status in ('success', 'partial', 'failed')),
  jobs_found    int,
  jobs_added    int,
  jobs_removed  int,
  error         text
);

create index if not exists jobs_active_first_seen_idx on jobs (first_seen_at desc) where removed_at is null;
create index if not exists jobs_company_active_idx on jobs (company_id) where removed_at is null;
create index if not exists jobs_country_idx on jobs (location_country) where removed_at is null;
create index if not exists scrape_runs_company_started_idx on scrape_runs (company_id, started_at desc);

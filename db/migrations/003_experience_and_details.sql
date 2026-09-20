alter table jobs add column if not exists experience_min int;

alter table jobs add column if not exists experience_max int;

alter table jobs add column if not exists experience_kind text check (experience_kind in ('explicit', 'estimated'));

alter table jobs add column if not exists details_checked_at timestamptz;

create index if not exists jobs_experience_idx on jobs (experience_min) where removed_at is null and experience_min is not null;

create table if not exists job_details (
  job_id     uuid primary key references jobs(id) on delete cascade,
  body       text not null,
  fetched_at timestamptz not null default now()
)

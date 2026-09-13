# Project Brief: Space/Defense Job Board

## What this is
A portfolio project: a job board aggregating open roles from space/defense
company career pages (Anduril, SpaceX, Palantir, RTX, Lockheed, Northrop,
etc.), inspired by jobyap.com but scoped to this one industry.
Non-commercial. Solo build, ~2 weeks.

## Explicit non-goals (do not build these)
- No user accounts, auth, or login
- No comments/discussion threads on postings
- No employer-facing tools (posting jobs, dashboards, applicant tracking)
- No real-time websocket "live" feed — "live" means the feed reflects the
  most recent cron scrape, not push updates
- No attempt to scrape ATS platforms that require auth or aggressively
  block bots — skip and log, don't fight it

## Stack
- Next.js (App Router, TypeScript) — SSR/ISR for indexable job + company pages
- Tailwind — styling
- Postgres via Neon — serverless, scale-to-zero, no realtime/auth needed
- Vercel — hosting + Vercel Cron (or GitHub Actions cron if Hobby tier
  interval limits become a problem) to trigger scrape runs
- Claude Code — primary build driver reading this file

## Data model (get this right before writing any adapter)

```sql
companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  logo_url      text,
  sector        text,        -- e.g. 'launch', 'prime', 'satellite', 'dual-use'
  source_type   text not null, -- 'greenhouse' | 'lever' | 'workday' | 'custom'
  source_config jsonb not null, -- board token, tenant id, base url, whatever the adapter needs
  active        boolean default true,
  created_at    timestamptz default now()
);

jobs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid references companies(id),
  external_id        text not null,   -- the ID from the source ATS, stable across runs
  title              text not null,
  location_raw       text,
  location_country   text,
  location_city      text,
  remote             boolean default false,
  department         text,
  url                text not null,
  salary_min         int,
  salary_max         int,
  salary_currency    text,
  posted_at          timestamptz,     -- from source if available, else first_seen_at
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  removed_at         timestamptz,     -- null = active; set when a scrape run doesn't see it
  source_type        text not null,
  tags               text[] default '{}',
  unique (company_id, external_id)
);

scrape_runs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references companies(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text,           -- 'success' | 'partial' | 'failed'
  jobs_found    int,
  jobs_added    int,
  jobs_removed  int,
  error         text
);
```

**Diffing logic (this is the core of "statistics" — build it into every
adapter from day one, not later):**
On each scrape run for a company:
1. Fetch current postings from source.
2. Upsert each by `(company_id, external_id)`: update `last_seen_at`, and
   other fields if changed; insert if new (sets `first_seen_at`).
3. Any job for that company with `removed_at is null` AND not present in
   this run's result set → set `removed_at = now()`.
4. Write one `scrape_runs` row summarizing found/added/removed counts.

This is what makes the stats page (added/removed/net, leaderboards, charts)
just a query over `jobs` + `scrape_runs` later — no separate event log needed.

## Scraper adapter contract
Every adapter is a function with this shape, regardless of source:

```ts
type NormalizedJob = {
  external_id: string;
  title: string;
  location_raw: string | null;
  remote: boolean;
  department: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | null; // ISO
};

type Adapter = (company: Company) => Promise<NormalizedJob[]>;
```

Adapters normalize into this shape; the diffing/upsert logic above is
source-agnostic and lives outside the adapters.

Build order for adapters: Greenhouse first (public JSON API,
`boards-api.greenhouse.io/v1/boards/{token}/jobs`), then Lever
(`api.lever.co/v0/postings/{site}`), then Workday last (client-rendered,
per-tenant paths — budget 2-3 days, treat as best-effort coverage, not
exhaustive).

## Coding conventions
- TypeScript strict mode, no `any` unless justified with a comment
- Server components by default; client components only where interactivity
  is required (filters, sort controls)
- All DB access through a single `lib/db.ts` — no scattered client instances
- Adapters live in `lib/adapters/{source}.ts`, one file per source type
- Env vars for anything secret or environment-specific; never hardcode
  company-specific tokens outside `source_config`

## Build order reference
1. Repo + Neon + CLAUDE.md (this file)
2. Claude Design pass for UI direction
3. App scaffold + schema migration
4. Greenhouse + Lever adapters, diffing logic, seed 15-20 companies
5. Cron wiring, first real scrape
6. Frontend wired to live data (feed, filters, stats)
7. Workday adapter for 2-3 priority companies
8. Coffee button (Stripe Payment Link, no custom payment flow)
9. Polish + deploy

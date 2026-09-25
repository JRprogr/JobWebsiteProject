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
  sector        text,        -- one of the 10 keys in lib/sectors.ts: prime, defence, launch, propulsion, satellites, components, earth-observation, space-ops, services, institutions
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
  country_hint?: string | null; // ISO-2 when the source provides one (e.g. Lever)
  description?: string | null; // plain text, only for jobs not processed before; used for experience extraction, never stored
};

type AdapterContext = {
  known: Map<string, string>; // external_id -> title of jobs whose details were already processed
  backfill: boolean; // CLI backfill may fetch many more detail pages than a cron run
};

type Adapter = (company: Company, ctx: AdapterContext) => Promise<NormalizedJob[]>;

// Per-source fetch of one listing's plain text; used by /api/jobs/[id]/details (fetched on demand, then cached in job_details)
type DetailFetcher = (company: Company, job: { external_id: string; url: string }) => Promise<string | null>;
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

## Schema additions since the original design
- `jobs.location_region` and `jobs.location_countries text[]` (all countries a posting lists; `location_country` stays the primary).
- `jobs.experience_min/max/kind` ('explicit' | 'estimated') extracted from listing text during scraping; `jobs.details_checked_at` marks jobs whose text was processed.
- `job_details(job_id, body, fetched_at)`: on-demand cache of listing text, capped at 20k chars per job. Full descriptions are deliberately NOT stored for every job (Neon free tier is 0.5 GB); re-extracting experience means re-reading sources (`npm run scrape -- --backfill`).
- `companies.careers_url` and `companies.hq_country`: shown on the Company Register page.

## Workday adapter (`lib/adapters/workday.ts`)
Pilot company: Airbus Defence and Space (`airbus-defence-and-space`). Airbus runs one Workday tenant (`ag`/`wd3`/site
`Airbus`) for its whole group, so `source_config.hiring_company_ids` holds the Workday `hiringCompany` facet ids for
just the Defence and Space legal entities (found via the tenant's own `/wday/cxs/{tenant}/{site}/jobs` facets) —
without it the adapter would pull in Airbus Commercial, Helicopters, etc. too. Workday's CXS API (what its own
careers UI calls) caps `limit` at 20 per page, so listing paginates; unlike Greenhouse/Lever/custom, both the
country and the city-level location only come back from the **per-job detail fetch**, not the cheap list endpoint —
budget a `--backfill` run after adding a new Workday company so location data isn't mostly empty until it trickles
in at 30 jobs/run. A posting's stable id is `bulletFields[0]`, not the tail of `externalPath` — Workday appends a
`-1`/`-2` disambiguator to the path (not the id) when two postings share a title and location.

Because location can be detail-gated like this, `lib/scrape.ts`'s upsert preserves the last-resolved
`location_country`/`location_countries`/`location_city` when a run doesn't produce a fresh value (mirrors how
`experience_min/max/kind` already only update when a run actually re-reads the description) — a company whose
adapter only returns real location on the runs it happens to detail a job must not have that job's location blanked
out on every other run.

Scoping options in `source_config` (all optional, tried in this order of preference):
- `hiring_company_ids`: Workday `hiringCompany` facet ids — when the tenant has that facet (Airbus, Leonardo).
- `search_text` + `bullet_match_regex`: for a shared tenant with no company facet (Thales): the CXS keyword search narrows the list, then any `bulletFields` entry must match the regex (Thales puts the legal entity there, e.g. "Thales Alenia Space France Sas").
- `exclude_locations_regex`: for a tenant with thousands of postings (RTX, ~4,800): the adapter reads the tenant's own `locations` facet on the first request and applies every location id whose descriptor does NOT match the regex, so paging never touches the excluded postings. RTX excludes non-European site prefixes, which keeps it at ~320 roles.
- `default_country`: resolves bare US state codes ("Huntsville, AL") for US-based tenants (Blue Origin, Vantor).

The requisition id is the first `bulletFields` entry that looks like an id (`^[A-Za-z]{0,4}-?\d{4,}$`), else the tail of `externalPath`; some tenants (Thales, RTX) put other fields first.

## Sector taxonomy
`lib/sectors.ts` is the single source for the 10 sector keys, their display labels and their display order. Every UI spot goes through `sectorLabel()`/`sortSectors()` — never `.toUpperCase()` a raw key.

## Company logos
`companies.logo_url` points at `public/logos/<slug>.png` (128x128, transparent). `npm run logos [slug ...]` downloads them (site apple-touch/svg icon first, gstatic favicon as fallback), using the domain in `db/seed/websites.json`, then writes `logo_url` into `db/seed/companies.json`; run `npm run db:seed` afterwards. Add every new company's domain to `websites.json`. `CompanyLogo` renders them on a white disc in both themes and falls back to the initial letter.

## ATS adapters added in Phase 2 (`lib/adapters/{personio,teamtailor,recruitee,bamboohr,ashby}.ts`)
All read the platform's public feed; helpers live in `lib/adapters/http.ts` (fetch with UA and timeout, `isEvergreen`) and `lib/xml.ts` (tiny tolerant XML reader).
- **personio**: `source_config {subdomain, tld ("de"|"com"), default_country}` → `https://<subdomain>.jobs.personio.<tld>/xml` (full descriptions inline). Falls back to `/search.json` when the XML feed 404s (Polaris).
- **teamtailor**: `{host, default_country}` → `https://<host>/jobs.rss` (works on custom domains too). Job id = the number in the `/jobs/<id>-slug` URL.
- **recruitee**: `{host, default_country}` → `https://<host>/api/offers/` (custom domains work).
- **bamboohr**: `{subdomain}` → `/careers/list` has city/state but **no country or text**; the per-job `/careers/<id>/detail` gives both, so it follows the Workday pattern (30 details per cron run, `--backfill` does all; the upsert preserves an already-resolved country).
- **ashby**: `{board, default_country}` → `https://api.ashbyhq.com/posting-api/job-board/<board>`; structured address country is used.
- `default_country` is only a fallback `country_hint` when a listing's location names no country the parser knows (it never overrides a parsed country). Evergreen entries ("Initiativbewerbung", "Unsolicited application", "Open applications", "Talent pool"…) are skipped by every one of these adapters via `isEvergreen`.
- New company checklist: seed entry in `db/seed/companies.json` (+ `db/seed/websites.json` domain), `npm run db:seed`, `npm run scrape <slug> -- --backfill`, `npm run logos <slug>`.

## ATS adapters added in Phase 3
- **successfactors** (`{base, prefix?, default_country?}`: ESA, SES, Beyond Gravity): server-rendered `<base><prefix>/search/?q=&startrow=N`, two layouts (table rows / tiles) parsed by `parseSearchPage`; pages until no new ids; per-job page text via `parseDlrPage` (30 detail fetches per cron run, `--backfill` all, like Workday). Locations arrive as "City, CC[, zip]" — `isoPlace()` splits the ISO code off as `country_hint`, because the location parser would read IN/DE/AL/… as US states.
- **custom kind `gkn-api`** (GKN Aerospace): `POST joinus.gknaerospace.com/api/jobs` pages of 50 with full descriptions; same ISO-code-as-hint handling.
- **factorial** (`{host, default_country}`): the start page lists all jobs (data attributes + location filter options); job page gives text and a "City, Country" chip.
- **hibob** (`{subdomain}`): `GET <sub>.careers.hibob.com/api/job-ad` with header `companyIdentifier: <sub>`; descriptions inline.
- **skeeled** (`{board_id}` or `{listing_url}`, plus `default_country`): board page cards, or (LIST) the employer's own page whose cards link to `app.skeeled.com/offer/c/<id>`; text from the offer page's `offer-description` block.
- **odoo** (`{host, default_country}`): `/jobs` cards (paged via `/jobs/page/N`), text from `itemprop="description"`. EnduroSat is NOT an Odoo jobs site (static page; Phase 5).
- `scripts/fetch-logos.mts` has an `OVERRIDES` map for logos that need a specific file/background (Novaspace, AST, Swissto12).

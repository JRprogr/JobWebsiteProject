# DS[Careers]

A job board for the European space and defence industry. It reads the public career pages of 100+ employers (primes,
launch and satellite companies, component makers, institutions), normalises the listings and keeps them in one
searchable, filterable feed with a country map, a company register and statistics on how the market moves.

It is a **non-commercial portfolio project**: no accounts, no ads, no employer tools. Every listing links back to the
employer's own application page.

Trial deployment: https://jw-project-eight.vercel.app (temporary address, will change with a proper domain).

## How it works

```
career pages / ATS feeds ──► adapters (lib/adapters) ──► diff + upsert (lib/scrape.ts) ──► Neon Postgres ──► Next.js pages
```

- **Adapters** turn one source type into a list of `NormalizedJob`s (contract in `lib/types.ts`). There is one file per
  ATS (Greenhouse, Lever, Workday, Personio, Teamtailor, SuccessFactors, …) plus one config-driven `link-list` adapter
  for small career pages without an ATS. Which adapter a company uses, and how it is configured, lives in
  `db/seed/companies.json` (`source_type`, `source_config`).
- **Diffing** happens once, outside the adapters: a run upserts what it sees, marks what it no longer sees as removed and
  writes one `scrape_runs` row. Statistics are plain queries over `jobs` and `scrape_runs`.
- **Experience and location** are extracted from the listing text while scraping (`lib/experience.ts`,
  `lib/location.ts`). The text itself is stored with the job, so the site never contacts an employer while you browse, and
  every listing links to the employer's own application page.
- **The site** is Next.js (App Router, server components) reading Postgres directly; filters live in the URL.

Deeper notes on every adapter, the data model and the conventions are in [CLAUDE.md](CLAUDE.md).

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Postgres on Neon (`@neondatabase/serverless`) · Vercel

## Running locally

Requires Node 24 and a Postgres database (a free Neon branch is enough).

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL
npm run db:migrate              # create / update the schema
npm run db:seed                 # load the company list
npm run scrape                  # first scrape of every active company (or: npm run scrape -- <slug>)
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run db:migrate` | Applies `db/migrations/*.sql` in order (tracked in `_migrations`) |
| `npm run db:seed` | Upserts `db/seed/companies.json` into `companies` |
| `npm run scrape -- [slug…] [--texts] [--backfill] [--force]` | Scrapes the given companies (all if none), four at a time; `--texts` also fetches every missing listing text (one-off catch-up), `--backfill` reads more listings per run for sources that fetch 30 at a time, `--force` skips the result guard |
| `npm run scrape -- --due` | Scrapes only the companies whose interval has elapsed, which is what the GitHub workflow runs every hour |
| `npm run logos -- [slug…]` | Rebuilds `public/logos/*.png`, see CLAUDE.md |
| `npm run build` | On a Vercel production deploy: migrate + seed, then `next build`. Elsewhere just `next build` |

### Adding a company

1. Add an entry to `db/seed/companies.json` (and the domain to `db/seed/websites.json`).
2. `npm run db:seed`, then `npm run scrape -- <slug> --backfill` and check the result.
3. `npm run logos -- <slug>` and `npm run db:seed` again for the logo.

## Deploying

Environment variables (see `.env.example`):

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Vercel (Production), GitHub Actions secret | Neon connection string of the **production** branch |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS` | Vercel, `.env.local` | Person responsible for the site (Impressum, Privacy page); address lines separated by `\|`. Kept out of the repository, and a production build fails without them |
| `NEXT_PUBLIC_SITE_URL` | Vercel, optional; GitHub Actions variable `SITE_URL` | Canonical URL (defaults to the Vercel production URL); the scraper's user agent points to it |

### Scraping

Scraping does not run on Vercel. `.github/workflows/scrape.yml` runs every hour and scrapes the companies that are due:
hourly by default, every six hours for the big career sites (`source_config.every_hours`). A run that would remove more than
30% of a company's jobs is held back until the next run confirms it, so a blocked or broken source cannot wipe a board.
The same run stores listing texts and tidies the database (scrape history older than 60 days, texts of jobs closed for a
month). Add the production connection string as the Actions secret `DATABASE_URL` and the public address as the Actions variable
`SITE_URL`. The workflow can also be started by hand for chosen companies, and with the "backfill" option it fetches every missing
listing text (the catch-up after adding companies or restoring a backup).

The bot identifies itself as `DSCareersBot` with the site address and a contact mailbox; employers can ask for removal via
the Q&A page.

### Site

Pushing to `main` deploys on Vercel (region `fra1`, see `vercel.json`). The production build first runs
`scripts/predeploy.mts`, which applies pending migrations and syncs the company list, so a failing migration stops the
deploy before it goes live. Preview and local builds never touch a database.

## Backups

`.github/workflows/backup.yml` dumps the production database every Sunday and keeps the dump as a workflow artifact for 30
days (Actions tab, the run, Artifacts). The dump holds companies, jobs and scrape history but leaves out the listing texts,
which the scraper refills. Neon itself keeps a short point-in-time history (6 hours on the free plan) for undoing a mistake.

To restore into an empty database (a new Neon branch or project), with the PostgreSQL 18 client tools installed:

```bash
pg_restore --no-owner --no-privileges --dbname "<connection string of the empty database>" backup.dump
```

Then point `DATABASE_URL` at it and run the scrape workflow once with the "backfill" option to bring the listing texts back.

Before a risky migration, create a Neon branch of production first (Branches, New branch): it is an instant snapshot that
can be kept for as long as needed.

The workflow uses the `DATABASE_URL` secret. A read-only role is safer: in the Neon SQL editor run
`create role backup_reader login password '…'; grant pg_read_all_data to backup_reader;` and store its connection string
as the Actions secret `BACKUP_DATABASE_URL`.

## Contact

Questions, corrections or requests to remove an employer: info.dscareers@proton.me

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
  `lib/location.ts`). Every listing links to the employer's own application page.
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
| `npm run scrape -- [slug…] [--backfill]` | Scrapes the given companies (all if none); `--backfill` reads many more listing texts |
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
| `DATABASE_URL` | Vercel (Production), GitHub secret | Neon connection string of the **production** branch |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS` | Vercel, `.env.local` | Person responsible for the site (Impressum, Privacy page); address lines separated by `\|`. Kept out of the repository, and a production build fails without them |
| `NEXT_PUBLIC_SITE_URL` | Vercel, optional | Canonical URL; defaults to the Vercel production URL |

Pushing to `main` deploys on Vercel (region `fra1`, see `vercel.json`). The production build first runs
`scripts/predeploy.mts`, which applies pending migrations and syncs the company list, so a failing migration stops the
deploy before it goes live. Preview and local builds never touch a database.

## Contact

Questions, corrections or requests to remove an employer: info.dscareers@proton.me

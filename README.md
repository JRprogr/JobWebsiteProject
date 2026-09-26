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

## Monitoring

`/api/health` answers 200 when the database is reachable and a scrape finished within the last three hours, and 503
otherwise (`down` or `stale`). `.github/workflows/monitor.yml` calls it every hour and fails, which makes GitHub email
you, when it does not answer 200 three times in a row. It needs the Actions variable `SITE_URL`. A site that is paused on
Vercel ("Pause Project") is recognised by its `x-vercel-error: DEPLOYMENT_PAUSED` header and skipped.

GitHub switches scheduled workflows off after 60 days without a commit to a public repository, which would silence the
scrape, the backup and this monitor together. An independent uptime monitor closes that gap: create a free HTTP monitor
(UptimeRobot, Better Stack, …) for `<SITE_URL>/api/health` that alerts on anything but 200. Set the interval to an hour or
more: every call queries the database, and a check every few minutes would keep the Neon compute awake around the clock and
use up the free compute-hours.

## Security and cost safety

**Nothing here can send you an invoice** as long as no payment method is attached: Vercel is on Hobby, Neon on Free, and the
repository is public. Overuse blocks a feature, it does not bill (provider documentation, September 2026):

- **Vercel Hobby** has no billing cycle; a limit that is exceeded (100 GB transfer, 1M function calls, 4 CPU-hours, …) blocks
  that feature for 30 days. DDoS mitigation is always on, and Attack Mode (Firewall, Bot Management) is free and its blocked
  requests do not count towards the limits.
- **Neon Free** suspends the compute when the 100 compute-hours or 5 GB of transfer per month are used up and refuses writes
  beyond 0.5 GB. It never deletes data.
- **GitHub Actions** minutes are free for public repositories on standard runners. If the repository is ever made private, the
  free quota is 2,000 minutes a month and the hourly scrape alone would use most of it.
- **No AI or other metered service** is called anywhere: the only dependencies are Next.js, React, the Neon driver and a PDF
  reader; there are no API keys besides the database connection.

Check once, by hand, that this stays true: Vercel Settings, Billing shows Hobby (not a Pro trial); Neon Billing shows Free;
GitHub Settings, Billing has no payment method. The Neon project that the Vercel integration created (if it still exists) is
not needed and can be deleted.

**How the site keeps its own load small**: the three pages that read the database (overview, register, statistics) are cached
by the CDN for five minutes (`next.config.ts`), the listing texts and the health check are cached as well, logos are plain
static files (no paid image optimisation), everything a visitor can type is length- and format-limited, and no request goes
to a third party. Security headers (CSP, frame, referrer, permissions, nosniff) are set for every response.

**Switch on by hand** (settings that code cannot change):

- Vercel, project, Firewall, Configure, New Rule: one rate-limit rule (Hobby allows one). Match the pages that read the
  database (path `/`, `/companies`, `/statistics`, `/api/…`, not `/_next/` or `/logos/`), for example 100 requests per 60 seconds per
  IP, first with the action Log for a few days, then Deny. During an attack turn on Firewall, Bot Management, Attack Mode.
- Vercel, Settings, Notifications: keep "Usage limit reached" and the anomaly alerts on (they are on by default).
- GitHub, repository, Settings, Code security: enable Dependabot alerts, Secret scanning and Push protection (both free for
  public repositories). Settings, Actions, General: require approval for workflows from outside contributors, and keep the
  default token permission read-only. Settings, Rules (or Branches): block force pushes and deletion of `main`.
- Neon: keep the Data API and Neon Auth switched off (they expose tables over HTTP).

**Least-privilege database role.** The running site only reads. Run this once in the Neon SQL editor (not with "Add role" in
the console: roles made there are members of `neon_superuser`, which can write everything):

```sql
create role site_reader login password '<a long random password>';
grant pg_read_all_data to site_reader;
```

Put that role's connection string into Vercel as `DATABASE_URL` and the owner's into Vercel as `DATABASE_ADMIN_URL`: a
production build uses the admin string for migrations and the company sync (`scripts/predeploy.mts`), the running site never
does. The same read-only string works as the `BACKUP_DATABASE_URL` Actions secret. Without `DATABASE_ADMIN_URL` the build
fails safely when `DATABASE_URL` is read-only. The scrape workflow keeps using the owner string as its `DATABASE_URL` secret.

**Secrets**: none are in the repository or its history (checked); they live in Vercel's environment settings (mark
`DATABASE_URL` Sensitive) and in GitHub's Actions secrets. The workflows run only on a schedule or by hand, never on pull
requests, so forks cannot reach the secrets. Report anything else to the address in [SECURITY.md](SECURITY.md).

**Accessibility** is documented, with the check that was run, in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Contact

Questions, corrections or requests to remove an employer: info.dscareers@proton.me

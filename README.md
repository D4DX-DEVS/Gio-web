# GIO Kerala website

Rebuild of [giokerala.org](https://www.giokerala.org) (Girls Islamic Organization Kerala), moving from WordPress/Elementor to Next.js on Cloudflare Workers.

This repository is the single source of truth for the project. Everything lives on the `main` branch:

- the **public website** (Malayalam and English content, news, events, leaders, gallery, documents, search, contact form),
- the **admin dashboard** at `/admin` (posts, pages, events, leaders, media, gallery, documents, menus, homepage, contact inbox, client review queue, old-URL decisions, settings),
- the **backend**: server code inside the same Next.js app (route handlers, server actions, Cloudflare D1 database, R2 media storage),
- the **content importer**, which moves content from a frozen snapshot of the old WordPress site into the database.

For where each part lives, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

## Technology

| Layer | Technology |
|---|---|
| Website and backend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Hosting | Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`), Wrangler 4 |
| Database | Cloudflare D1 (SQLite) with Drizzle ORM |
| Media storage | Cloudflare R2 |
| Admin login | Better Auth, one admin account set by environment variables, optional TOTP two-factor, login rate limiting |
| Package manager | pnpm 10 workspace, Node.js 22 |

## Requirements

- Node.js 22 (22.12 or newer, below 23)
- pnpm 10.34.7: run `corepack enable pnpm` once and Corepack picks the version from `package.json`
- Git

Windows, macOS and Linux all work. On Windows, do not keep the project inside a OneDrive folder.

## Installation

```bash
git clone https://github.com/D4DX-DEVS/Gio-web.git gio-kerala
cd gio-kerala
corepack enable pnpm
pnpm install
```

## Environment setup

Secrets are never committed. The repository only contains example files with variable names.

1. Copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars`.
2. Fill in the values:

   | Variable | What to put |
   |---|---|
   | `BETTER_AUTH_SECRET` | a long random string, for example from `npx @better-auth/cli secret` |
   | `BETTER_AUTH_URL` | `http://localhost:3000` for local development |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | the admin login (password at least 12 characters) |
   | `ADMIN_NAME` | name shown in the admin sidebar (optional) |
   | `ADMIN_TOTP_SECRET` | two-factor secret, from `node apps/web/scripts/generate-totp-secret.mjs`. Optional for `pnpm dev`, **required** for `pnpm preview` and production |

3. The full list of variable names, including ones for later (Turnstile, email, Cloudflare Access), is in [.env.example](.env.example).

## Database and content

The site reads all content from a local Cloudflare D1 database and local R2 media storage. Both live in `apps/web/.wrangler/state/`, which is not in Git.

A fresh clone starts with an **empty database**. Choose one:

- **Copy the existing local data (fastest).** Ask the project owner for a copy of `apps/web/.wrangler/` (about 475 MB) and put it in the same place. It has all imported content plus admin changes.
- **Run the importer.** Ask the project owner for the frozen WordPress snapshot (`migration/snapshot-2026-10-27/`, not in Git because it contains personal data and the old site's API key) and put it in `migration/`. Then:

  ```bash
  pnpm importer build                               # snapshot -> import bundle
  pnpm importer files --yes                         # download the old site's images once (about 415 MB)
  pnpm importer load                                # create the tables, load content and images into local D1 and R2
  pnpm importer verify                              # check the result
  ```

Both the snapshot and the database copy must be handed over privately (not through Git, chat or email attachments that are shared widely).

## Running the website

```bash
pnpm dev
```

- Website: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin/ (sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`)

The first visit to each page compiles it and can take a few seconds.

To see the site exactly as it will run on Cloudflare (Workers runtime, old WordPress links and image URLs):

```bash
pnpm preview          # builds, then serves http://localhost:8787
```

`pnpm preview` is a production build, so admin sign-in needs `ADMIN_TOTP_SECRET`.

## Running the importer

The importer is in `apps/importer`. It reads only the local snapshot; it never changes the live WordPress site or a Cloudflare account.

```bash
pnpm importer build              # snapshot -> migration/staging/<snapshot>/bundle.json
pnpm importer files --dry-run    # list the images that would be downloaded
pnpm importer files --yes        # download them into migration/media-cache/
pnpm importer load               # bundle + images -> local D1 and R2
pnpm importer verify             # checks; report in migration/migration-reports/latest.md
pnpm importer all                # build + load + verify
```

Running it again does not create duplicates. Details: [docs/migration/IMPORTER.md](docs/migration/IMPORTER.md).

## Checks

```bash
pnpm typecheck        # TypeScript, all packages
pnpm lint             # ESLint
pnpm test             # website tests, then importer tests
pnpm check:legacy-preview http://localhost:8787   # old WordPress URLs, against a running preview
```

Some tests use the local snapshot; without it they are skipped.

## Build and deploy

```bash
pnpm build            # Next.js production build
pnpm build:cf         # Cloudflare Workers build (output in apps/web/.open-next/)
```

**Deployment status:** nothing is deployed yet. `apps/web/wrangler.jsonc` is a local-only configuration: the D1 `database_id` is a placeholder and there are no staging or production environments. Before the first deployment:

1. Create the Cloudflare D1 database and R2 buckets, and put their IDs and names in `apps/web/wrangler.jsonc` (add `staging` and `production` environments).
2. Set the secrets with `wrangler secret put <NAME>` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`). Never put them in `wrangler.jsonc`.
3. Apply the database migrations remotely: `pnpm --filter web exec wrangler d1 migrations apply DB --remote`.
4. Deploy: `pnpm --filter web exec opennextjs-cloudflare deploy`.

The open decisions that block deployment are listed in [docs/audit/04-STATUS-AND-DECISIONS.md](docs/audit/04-STATUS-AND-DECISIONS.md).

## Git workflow

- `main` holds the current, complete project. Start new work on a branch from `main` and merge it back with a pull request.
- Never commit `.dev.vars`, `.env`, the snapshot, `migration/` data or `.wrangler/`; `.gitignore` already blocks them.

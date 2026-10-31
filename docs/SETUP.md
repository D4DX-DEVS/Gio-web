# GIO Kerala rebuild: local setup

- **Date:** 27 October 2026 (updated 28 October 2026)
- **Status:** the local workspace exists at `C:\dev\gio-kerala` (phase 1 on branch `phase-1/foundation-spikes`; the legacy URL and media layer on `phase-2/legacy-url-layer`). There are still no Cloudflare resources and nothing is deployed. Installed versions, test results and deviations from the steps below are in `docs/architecture/PHASE_1_SPIKE_RESULTS.md`; the custom Worker entry is described in `docs/architecture/LEGACY_URL_AND_MEDIA_LAYER.md`.
- **Note (31 October 2026):** this is the original setup log, kept for its decisions and reasoning. For current setup and commands, use the root `README.md` and `PROJECT_STRUCTURE.md`. Since 31 October all work is on one branch, `main`; the importer has moved from `tools/migrate` to `apps/importer`, and the audit scripts from `migration/scripts-*` to `scripts/wordpress-audit/`.
- **Read first:** `docs/audit/04-STATUS-AND-DECISIONS.md` (blocking decisions), `docs/audit/05-MIGRATION-DESIGN.md` (architecture), `docs/audit/d1-schema-proposal.sql`.

Everything in this file runs on the developer machine only. Commands that create or change anything in a Cloudflare account are listed separately in §7 and must not be run until decision C1 (Cloudflare account access) is answered.

---

## 1. What is in git and what is not

| Tracked | Not tracked (local and `gio-private` R2 only) |
|---|---|
| `docs/audit/*` deliverables, stored byte-for-byte (`.gitattributes` marks them `-text`) | `migration/snapshot-*/`: frozen public snapshot (HTML, REST JSON incl. `users.json`, CSS, HEAD results). Contains the live site's exposed Google Maps API key and WordPress nonces |
| `docs/audit/inventory/*.csv` **except** `url_inventory.csv` | `docs/audit/inventory/url_inventory.csv`: contains the same Google Maps API key in its `iframes` column (row 11) |
| `migration/scripts-audit/`, `migration/scripts-plan/` | `migration/staging/`, `migration-reports/`, `wp-source/`: importer output, client DB dump, WXR export, uploads ZIP |
| `.env.example` (names only) | `.env*`, `.dev.vars*`: real values |
| application code, Drizzle migrations | `node_modules/`, `.next/`, `.open-next/`, `.wrangler/` (local D1/R2 state), archives, dumps, local databases |

Check before every commit:

```powershell
git add -A --dry-run
git status --ignored --short
```

Recommended extra guard (optional): install [gitleaks](https://github.com/gitleaks/gitleaks) and run `gitleaks git --staged` before committing, or as a pre-commit hook.

The repository must stay **private**. `docs/audit/inventory/leaders.csv` contains names, roles, photo URLs and social links of 123 people as published on the live site.

---

## 2. Required software

| Tool | Required | On this machine (27 Oct 2026) | Notes |
|---|---|---|---|
| Node.js | 22 LTS (Wrangler 4 needs ≥ 22; Next.js 16 needs ≥ 20.9) | 22.23.2 via nvm-windows | OK |
| npm | bundled | 10.9.8 | OK |
| pnpm | **10.34.7** (≥ 10.34.5: earlier releases have high-severity advisories) | 10.34.7 via Corepack since 28 Oct | pinned in the root `package.json` `packageManager` field |
| Corepack | bundled with Node 22 | 0.34.6 | OK |
| Git | any recent | 2.55.0 | OK; `user.name`/`user.email` set |
| Wrangler | 4.x, installed **per project** as a dev dependency | not installed globally | do not install globally; use `pnpm exec wrangler` |
| Python | 3.10+ for the audit scripts | 3.12.0 | OK |
| Docker or Podman | only for phase 6 (throwaway MariaDB to read the client's SQL dump) | **not installed** | not needed until the dump arrives |

Install pnpm:

```powershell
corepack enable pnpm
# If nvm-windows blocks Corepack from writing shims (permission error), use instead:
npm install -g pnpm
pnpm --version
```

---

## 3. Recommended stack and versions

Versions as on the npm registry on 27 Oct 2026. Pin exact versions in the lockfile; let `minimumReleaseAge` (§5) avoid packages published in the last 14 days, except where a security patch is required.

| Package | Version line | Why |
|---|---|---|
| `next` | 16.4.x, **≥ 16.4.1** | `@opennextjs/cloudflare` 1.20.13 requires `>=15.5.28 <16 \|\| >=16.4.1`; App Router, React 19 |
| `react`, `react-dom` | 19.x (whatever `next` 16.4 pins) | |
| `@opennextjs/cloudflare` | 1.20.x | Next.js on Cloudflare Workers with direct D1/R2 bindings (decision D2) |
| `wrangler` | 4.x, ≥ 4.148 | peer requirement of OpenNext; local D1/R2 emulation via Miniflare |
| `drizzle-orm` / `drizzle-kit` | 0.45.x / 0.31.x | schema and migrations for D1 |
| `better-auth` | 1.7.x | admin auth, email + password + TOTP 2FA (decision D3) |
| `zod` | 4.x | validation |
| `typescript` | **5.9.3** (not 7.x) | TypeScript 7 is the new native compiler; keep 5.9 until Next.js, drizzle-kit and ESLint tooling confirm 7.x support |
| `tailwindcss` | 4.x | per `02-ARCHITECTURE-PLAN.md` |

Exact pinned versions (and why some differ from this table, e.g. wrangler 4.150.0, better-auth 1.7.7, react 19.3.1, @opennextjs/cloudflare 1.20.13) are in `docs/architecture/PHASE_1_SPIKE_RESULTS.md` §2.

To verify in the phase 1 spike, before building on them (results: `docs/architecture/PHASE_1_SPIKE_RESULTS.md`):

1. Next.js 16 renamed `middleware.ts` to `proxy.ts` (Node.js runtime by default). Confirm what OpenNext 1.20 supports; the legacy-URL redirect layer (`05` §6.1 step 7) depends on it.
2. FTS5 `trigram` tokenizer on D1 (`05` §4).
3. Cloudflare Image Transformations on R2 originals (`05` §5.1).
4. Better Auth's Drizzle adapter on D1 with a per-request binding from `getCloudflareContext()`.

---

## 4. Recommended project structure

```
gio-kerala/                      repo root (this folder, ideally moved out of OneDrive, see §5 step 1)
├── apps/
│   └── web/                     Next.js 16 + OpenNext: public site and /admin
│       ├── src/app/             App Router routes
│       ├── wrangler.jsonc       bindings: DB (D1), MEDIA and PRIVATE (R2); envs: staging, production
│       ├── open-next.config.ts
│       └── .dev.vars            local secrets (git-ignored; copied from /.env.example)
├── packages/
│   └── db/                      Drizzle schema (from docs/audit/d1-schema-proposal.sql) + migrations/
├── tools/
│   └── migrate/                 importer CLI: snapshot, extract, normalise, merge, transform, files, load, verify, delta
├── docs/
│   ├── audit/                   existing deliverables (unchanged)
│   └── SETUP.md                 this file
├── migration/
│   ├── scripts-audit/           tracked
│   ├── scripts-plan/            tracked
│   └── snapshot-2026-10-27/     local only, never committed
├── package.json                 workspace root
├── pnpm-workspace.yaml
├── .env.example
├── .gitattributes
└── .gitignore
```

`packages/db` is shared because both the web app and the importer write the same tables. `wrangler.jsonc` points `migrations_dir` at `../../packages/db/migrations`.

---

## 5. Initialise the project (local only)

Run in PowerShell. Steps 1-2 are one-off decisions; nothing below contacts a Cloudflare account.

> **Done on 28 Oct 2026.** Steps 1-8 were carried out, with these deviations: the project was **copied** (the OneDrive folder was left untouched; all 254 files were verified by SHA-256); OpenNext was configured by hand instead of with `opennextjs-cloudflare migrate`; `pnpm-workspace.yaml` sets `nodeLinker: hoisted`, because on Windows without Developer Mode the OpenNext build fails with `EPERM ... symlink`. The phase-1 spike code and its `ENABLE_SPIKES` flag were removed in phase 2 (the code is still in commit `3250241`). On a fresh clone, run `corepack enable pnpm`, `pnpm install`, copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars` and fill it in, then run `pnpm db:migrate:local`.

**1. Move the project out of OneDrive (recommended before any `pnpm install`).** `node_modules`, `.next` and `.wrangler` inside a synced folder cause slow installs and file-lock errors. Copy, verify, then remove the OneDrive copy only after checking:

```powershell
robocopy "C:\Users\shani\OneDrive\Desktop\gio-new" "C:\dev\gio-kerala" /E /COPY:DAT /DCOPY:T
cd C:\dev\gio-kerala
git status
```

**2. First commit** (after reviewing the dry run):

```powershell
git add -A --dry-run
git add -A
git commit -m "chore: audit deliverables, gitignore and setup docs"
```

**3. Workspace root:**

```powershell
pnpm init
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - tools/*

# Do not install versions published in the last 14 days (minutes).
minimumReleaseAge: 20160
# Security patch lines that must not wait:
minimumReleaseAgeExclude:
  - next
```

Set `"packageManager"` in the root `package.json` to the installed pnpm version (`pnpm --version`), and `"engines": { "node": ">=22 <23" }`.

**4. Scaffold the Next.js app** (no install, no git, no deploy):

```powershell
pnpm create next-app@16.4 apps/web --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-pnpm --skip-install --disable-git
```

**5. Add OpenNext for Cloudflare** (creates `wrangler.jsonc`, `open-next.config.ts`, adds `initOpenNextCloudflareForDev()` to `next.config.ts` and the `preview`/`deploy` scripts):

```powershell
cd apps/web
pnpm dlx @opennextjs/cloudflare@1.20 migrate
cd ../..
```

Review the generated `package.json` scripts and **remove or rename any `deploy` / `upload` script** until decision C1, so nothing is deployed by accident.

**6. Pin TypeScript and add the planned libraries:**

```powershell
pnpm --filter web add -D typescript@5.9.3 wrangler@4 @opennextjs/cloudflare@1.20 drizzle-kit@0.31
pnpm --filter web add drizzle-orm@0.45 better-auth@1.7 zod@4
pnpm install
```

**7. Local bindings.** In `apps/web/wrangler.jsonc` add a D1 binding `DB` and R2 bindings `MEDIA` and `PRIVATE`. For local development the `database_id` can be the placeholder `00000000-0000-0000-0000-000000000000`; Miniflare stores local data in `.wrangler/state/` and does not need a real database or bucket. Then generate binding types:

```powershell
pnpm --filter web exec wrangler types --env-interface CloudflareEnv
```

**8. Local secrets:**

```powershell
Copy-Item .env.example apps/web/.dev.vars
pnpm dlx @better-auth/cli@1.7 secret
```

Paste the generated secret into `BETTER_AUTH_SECRET` in `apps/web/.dev.vars` and set `BETTER_AUTH_URL=http://localhost:3000`. Leave the developer-machine-only section empty or delete it from `.dev.vars`; those values are for the shell, not the Worker.

---

## 6. Run locally

| Purpose | Command | URL |
|---|---|---|
| Next.js dev server with local D1/R2 bindings | `pnpm --filter web dev` | http://localhost:3000 |
| Build and run inside the Workers runtime (workerd), as production would | `pnpm --filter web preview` | http://localhost:8787 |
| Apply D1 migrations to the **local** database | `pnpm --filter web exec wrangler d1 migrations apply DB --local` | |
| Inspect the local database | `pnpm --filter web exec wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master"` | |
| Type check | `pnpm --filter web exec tsc --noEmit` | |
| Lint | `pnpm --filter web lint` | |

Always pass `--local` to `wrangler d1` commands until a staging database exists.

Root shortcuts (from the repo root): `pnpm dev`, `pnpm build`, `pnpm build:cf` (OpenNext build only), `pnpm preview`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:generate`, `pnpm db:migrate:local`.

**Legacy URL and media layer** (`apps/web/worker.ts`, `apps/web/src/legacy/`; design in `docs/architecture/LEGACY_URL_AND_MEDIA_LAYER.md`):

| Purpose | Command |
|---|---|
| Unit and audit tests (Node's built-in test runner; no extra dependency) | `pnpm test` |
| Regenerate the redirect and media data from the audit CSVs and the local snapshot | `pnpm generate:legacy` |
| Fail if the generated data is out of date | `pnpm check:legacy` |
| End-to-end check against a running `pnpm preview` | `pnpm check:legacy-preview` (default `http://localhost:8787`) |

**Dev mode vs Cloudflare preview mode.** `pnpm dev` runs Next's own Node.js dev server with hot reload, and bindings are emulated through `getCloudflareContext()`. `pnpm preview` builds the real Worker bundle and runs it in `workerd` (the Workers runtime), which is closer to production. The two differ in ways that matter:

- **The custom Worker entry runs only in preview and production.** Under `pnpm dev` there are no legacy redirects, no 410s and no `/wp-content/uploads/*` handling.
- `.dev.vars` values reach `process.env` only in preview.
- OpenNext's router does not apply the trailing-slash redirect to `/api/*`, while `next dev` does.

Use dev for UI work. Run `pnpm test`, then `pnpm preview` with `pnpm check:legacy-preview`, before merging anything that touches routing, legacy URLs, media, bindings or auth. Details: `docs/architecture/PHASE_1_SPIKE_RESULTS.md` §4.1.

On Windows, stopping `pnpm dev` or `pnpm preview` from a tool may leave `workerd.exe` running and holding port 8787. Stop the whole process tree (`taskkill /PID <pid> /T /F`).

---

## 7. Not yet: commands that need client approval

Do **not** run any of these until the decisions in `04-STATUS-AND-DECISIONS.md` §3.1 are answered (D1, D2, D3, C1, C2):

- `wrangler login` against the client's account
- `wrangler d1 create ...`, `wrangler r2 bucket create ...`
- `wrangler secret put ...`
- `wrangler d1 migrations apply ... --remote`
- `opennextjs-cloudflare deploy`, `wrangler deploy`, any `deploy` script
- any DNS, route or Access change on giokerala.org

The importer (`tools/migrate`) never reads the live site except through its explicit `snapshot` command (GET/HEAD, rate-limited), and never loads client data until the client supplies it and approves the import.

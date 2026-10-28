# Handoff report: local project foundation prepared

I am rebuilding a website with an AI coding agent (Claude Code). Below is the status after the latest task. Please read it and advise what I should do next.

## Project

- **Site:** giokerala.org (GIO Kerala, a Malayalam-language student/youth organisation site). Today it runs on WordPress + Elementor.
- **Target stack:** Next.js (App Router) on Cloudflare Workers via `@opennextjs/cloudflare`, Cloudflare D1 (SQLite) with Drizzle ORM, Cloudflare R2 for media, Better Auth (email + password + 2FA) plus Cloudflare Access protecting `/admin`, Turnstile on the contact form.
- **Ground rules:** preserve every verified piece of content and every old URL; never invent or "correct" content without written client approval; never write to the live WordPress site (read-only GET/HEAD only); keep all original WordPress files.

## Phases so far

1. **Audit and planning (done earlier):** five documents (audit report, architecture plan, migration checklist, status and decisions, migration design), CSV inventories (139 URLs, 34 posts, 123 leader entries, 322 assets, 20 files missing from the media API, a 139-row URL map), a proposed D1 schema (41 tables + FTS5 search), and a 21 MB frozen snapshot of the public site (146 HTML pages, REST JSON, Elementor CSS, HEAD results for 345 file URLs).
2. **Local foundation prep (this task, 27 Oct 2026).**

## What this task did

- Verified every audit document, inventory, snapshot folder and script is present; all counts match the documents.
- Scanned for secrets without printing values. Found one real issue: the **Google Maps API key that the live site already exposes publicly** appears in 3 local files (two snapshot files and one inventory CSV). Everything else that matched (Cloudflare analytics beacon token, WordPress nonces, REST "password" field descriptions) is not sensitive. No credentials in any script.
- Initialised Git (`main` branch). **No commits made yet.**
- Added `.gitignore`: excludes the frozen snapshot, importer output, client DB dumps / WXR exports / uploads ZIPs, archives, local databases, all `.env*` and `.dev.vars*` files, key files, and build output (`.next`, `.open-next`, `.wrangler`, `node_modules`). Also excludes `docs/audit/inventory/url_inventory.csv` because it contains the Maps key (GitHub push protection would block it). Rules were tested against sample paths; the would-be-committed set is 23 files and contains no keys.
- Added `.gitattributes`: audit files stored byte-for-byte (CSV files have a BOM, some scripts have CRLF).
- Added `.env.example` with variable names only (Better Auth, Cloudflare Access, Turnstile, email, IP hash salt, Instagram, Sentry, plus developer-only Cloudflare API token, R2 S3 keys and migration source paths).
- Added `docs/SETUP.md` with the recommended structure, versions and exact local-only commands.
- Did **not**: create the website, install packages, import client data, create Cloudflare resources, or deploy. No existing audit file was modified, moved or deleted.

## Environment check

- Installed: Node 22.23.2, npm 10.9.8, Git 2.55, Python 3.12, Corepack.
- Missing: **pnpm** (to install via `corepack enable pnpm`), Docker (only needed later to read the client's SQL dump in a throwaway MariaDB), Wrangler (will be a per-project dev dependency, not global).
- The project folder is inside **OneDrive**, which causes slow installs and file locks with `node_modules`. Recommended: copy to `C:\dev\gio-kerala` before installing anything.

## Recommended setup

- pnpm workspace: `apps/web` (Next.js + OpenNext), `packages/db` (Drizzle schema + migrations, shared), `tools/migrate` (importer CLI: snapshot, extract, normalise, merge, transform, files, load, verify, delta).
- Versions (npm registry, 27 Oct 2026): Next.js 16.4.x (at least 16.4.1, required by the adapter), `@opennextjs/cloudflare` 1.20.x, Wrangler 4.x (at least 4.148), Better Auth 1.7.x, drizzle-orm 0.45 / drizzle-kit 0.31, Zod 4, Tailwind 4, **TypeScript pinned to 5.9.3** (not the new 7.x native compiler, until tooling confirms support). pnpm `minimumReleaseAge` of 14 days to avoid freshly published packages, with Next.js excluded so security patches are not delayed.
- Local development needs no Cloudflare account: D1 and R2 are emulated locally by Wrangler/Miniflare with a placeholder database ID.

## Technical risks to check first (phase 1 spike)

1. Next.js 16 renamed `middleware.ts` to `proxy.ts` (Node.js runtime). Unconfirmed whether the Cloudflare adapter supports it; the legacy-URL redirect layer depends on it.
2. FTS5 `trigram` tokenizer on D1, needed for Malayalam search.
3. Cloudflare Image Transformations on R2 originals (to serve old WordPress resized-image URLs).
4. Better Auth's Drizzle adapter on D1 with a per-request binding.

## Pending decisions

**From the client (block implementation):**
- D1: confirm Cloudflare D1 as the database.
- D2: confirm Cloudflare Workers via OpenNext as the runtime.
- D3: confirm Better Auth + Cloudflare Access for admin login.
- C1: access to the Cloudflare account (scoped token / member access, staging only, no DNS changes).
- C2: admin users, emails and roles (at least two owners).
- C3: WordPress database dump (or WXR export) and a ZIP of `wp-content/uploads`.
- C17: the Google Maps key owner should restrict or rotate the key.

**From me (the developer):**
- Move the project out of OneDrive now?
- Track a redacted copy of `url_inventory.csv` so the URL-map script can run from a fresh clone?
- Which private Git host (e.g. private GitHub repo)?
- Approve the first commit.

## Proposed next steps

1. Install pnpm; optionally copy the project to `C:\dev\gio-kerala`.
2. Make the first commit after reviewing the dry run.
3. Create the pnpm workspace, scaffold `apps/web` with `create-next-app@16.4`, add Cloudflare support with `@opennextjs/cloudflare migrate`, pin versions.
4. Add local D1/R2 bindings, copy `.env.example` to `apps/web/.dev.vars`, run `pnpm --filter web dev` and `pnpm --filter web preview`.
5. Run the four phase-1 spikes, then turn the D1 schema proposal into Drizzle migrations and apply them locally.

## Questions for you (ChatGPT)

1. Given that client decisions D1-D3 and C1-C3 are still open, is it sensible to proceed with the local-only scaffold and phase-1 spikes now, or should anything wait?
2. Is the pnpm workspace layout (`apps/web`, `packages/db`, `tools/migrate`) appropriate for this size of project, or would a single Next.js app with a `scripts/migrate` folder be simpler and safer?
3. Any concerns with the version choices (Next.js 16.4 + OpenNext 1.20, TypeScript 5.9 instead of 7, 14-day minimum release age)?
4. What exact instruction should I give the coding agent for the next task?

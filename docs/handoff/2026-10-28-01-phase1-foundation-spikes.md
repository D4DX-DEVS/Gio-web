# Handoff report: phase 1 local foundation and compatibility spikes

I am rebuilding a website with an AI coding agent (Claude Code). Below is the status after the latest task. Please read it and tell me what I should do next.

## Project

- **Site:** giokerala.org (GIO Kerala, a Malayalam-language student/youth organisation). It currently runs on WordPress + Elementor.
- **Target stack:** Next.js (App Router) on Cloudflare Workers via `@opennextjs/cloudflare`, Cloudflare D1 (SQLite) with Drizzle ORM, R2 for media, Better Auth (email + password + 2FA) plus Cloudflare Access for `/admin`.
- **Ground rules:** never write to the live WordPress site; never invent or change content without client approval; preserve every old URL; no secrets in git; nothing remote (no Cloudflare resources, no deploys) until the client gives account access.

## What this task did (28 Oct 2026, all local)

- Copied the project out of OneDrive to `C:\dev\gio-kerala`. All 254 files were verified by SHA-256, and the OneDrive original is untouched.
- Made the first git commit (24 reviewed files: audit docs, scripts, gitignore, setup docs; no snapshot, no file containing the Google Maps key), then created the branch `phase-1/foundation-spikes`.
- Created a pnpm workspace: `apps/web` (Next.js 16.4.3), `packages/db` (Drizzle schema for the Better Auth tables, with the first migration), `tools/migrate` (placeholder CLI).
- Configured OpenNext + Wrangler for local use only: a placeholder D1 id, emulated R2 buckets and Images binding, and no deploy/upload scripts.
- Ran four compatibility spikes. Wrote `docs/architecture/PHASE_1_SPIKE_RESULTS.md` (full evidence) and updated `docs/SETUP.md`.

## Versions (exact pins; 14-day minimum release age with documented exceptions)

Next 16.4.3 (Next 16.4.0 and older have critical RCE advisories), React 19.3.1, @opennextjs/cloudflare 1.20.13 (1.20.12 is the first release supporting Next 16.4), Wrangler 4.150.0, Better Auth 1.7.7, drizzle-orm 0.45.4 / drizzle-kit 0.31.11, TypeScript 5.9.3, Tailwind 4.3.3, pnpm 10.34.7 (older versions have advisories), Node 22.23.2. `pnpm audit` reports 17 advisories, all in local or build tooling (Wrangler's local server, OpenNext build CLI, drizzle-kit), none in the deployed Worker code. Wrangler 4.154 fixes most of them.

## Test results

- `next dev`: PASS. `next build`: PASS. Typecheck (3 packages): PASS. ESLint: PASS.
- OpenNext Cloudflare build: first FAIL on Windows (`EPERM ... symlink`); PASS after setting pnpm `nodeLinker: hoisted`.
- Local Workers preview (workerd): PASS.
- Spike suite: **25/25 in the Workers preview and 25/25 in `next dev`**. With spikes switched off, all spike routes return 404.
- Nothing was tested on real Cloudflare. That is **BLOCKED** until the client provides account access.

## The four findings

1. **Next.js 16 `proxy.ts` (legacy redirects):** works locally under OpenNext, including Malayalam percent-encoded slugs, `?p=` rules, 410 rules and D1 lookups. But OpenNext says Node.js middleware on Cloudflare is "experimental and not officially maintained". The supported alternative, a custom Worker entry that handles legacy URLs before Next.js, was also tested and works. Recommendation: use the custom Worker entry for redirects and old image URLs.
2. **D1 FTS5 trigram search (Malayalam):** trigram works locally. Malayalam needs a search-only normaliser: Unicode NFC does not unify the two ways of writing chillu letters, so the normaliser does NFC plus a chillu mapping. Queries under 3 code points need a `LIKE` fallback. Cloudflare documents FTS5 on D1 but not the trigram tokenizer, so production support is unverified. Important: **D1 export does not work on databases that contain virtual tables**, which conflicts with the planned nightly backups. Recommendation: keep the search index in a separate, rebuildable D1 database.
3. **R2 + old WordPress resized-image URLs:** works locally. `name-300x200.jpg` is mapped to the original (or the `-scaled` original) and resized through the Images binding. But the local Images binding is a low-fidelity emulation (Sharp). In production it is billed per unique transformation (5,000 a month free, then new transformations fail on the Free plan; $0.50 per 1,000 on Paid). Production needs a size allow-list and caching. The alternative is to store WordPress's resized files from the uploads ZIP.
4. **Better Auth + Drizzle + D1:** sign-up, sign-in, server-side session reading, sign-out, TOTP 2FA enrolment and 2FA sign-in all work locally. Requirements found: create the auth instance per request; enable `skipTrailingSlashes`, because `next dev` and the Workers router treat trailing slashes on `/api/*` differently. Big risk: password hashing uses scrypt (about 220 ms per hash), while the **Workers Free plan allows 10 ms CPU per request**, so the client will very likely need **Workers Paid**. Rate-limit storage, mandatory 2FA enforcement, invite-only sign-up and password-reset email are still to be built (email needs a provider decision).

## Not done (deliberately)

No website content, admin dashboard, production auth, content schema, importer logic, Cloudflare resources or deployment. The spike code is still in the branch behind an `ENABLE_SPIKES` flag and should be removed before feature work.

## Pending decisions

**Client:** Cloudflare account access and plan (C1; Workers Paid recommended); confirm D1, Workers/OpenNext and Better Auth (D1-D3); image strategy (Images binding vs storing WordPress's resized files); email provider (C9); database dump and uploads ZIP (C3).

**Me:**
1. Approve the custom Worker entry for redirects and media (changes the design doc's "middleware" step).
2. Approve a separate D1 database for search.
3. Whether to wait for or exempt Wrangler 4.154 (security fixes in local tooling).
4. Build staging bundles on Linux CI rather than Windows (OpenNext warns Windows is not fully supported).

## Recommended next task

Build the legacy URL and media layer locally: a custom Worker entry using a pure, unit-tested `resolveLegacyRequest()` (exact redirects, the pattern rules from the design doc, `/wp-content/uploads` with `-scaled`, allow-listed sizes and caching). Test it against all 139 rows of `url_map.csv`: the 69 verified rows pass through, and the 70 pending rows produce no redirect. Also test the 34 Malayalam post URLs byte for byte, then remove `proxy.ts` and the spike routes. A second agent session has offered to build the WordPress importer and content schema in a separate git worktree, in parallel.

## Questions for you (ChatGPT)

1. Do you agree with replacing `proxy.ts` with a custom Worker entry for the legacy redirect and image layer, given OpenNext's "experimental" label?
2. Is a separate D1 database for the FTS5 search index a sound answer to the export limitation, or is there a simpler approach (e.g. relying on D1 Time Travel instead of exports)?
3. How should I present the Workers Paid recommendation and the image-cost question to a non-technical client?
4. What exact instruction should I give the coding agent next?

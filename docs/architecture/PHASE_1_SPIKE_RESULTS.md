# GIO Kerala rebuild: phase 1 foundation and compatibility spikes

- **Date:** 28 October 2026
- **Branch:** `phase-1/foundation-spikes` (baseline commit `60c9d6c` on `main`)
- **Scope:** local only. No Cloudflare account was used, no remote resource was created, nothing was deployed, and the live site was not contacted.
- **Read with:** `docs/audit/04-STATUS-AND-DECISIONS.md` (decisions), `docs/audit/05-MIGRATION-DESIGN.md` (architecture), `docs/SETUP.md` (commands).

Status labels used below:

- **PASS:** run here and the output was inspected.
- **FAIL:** run here and it failed.
- **BLOCKED:** cannot be verified without something we do not have yet, usually a Cloudflare account (decision C1).
- **NOT TESTED:** deliberately out of scope for this spike.

---

## 1. Summary

| Spike | Local result (Workers runtime, `opennextjs-cloudflare preview`) | Local result (`next dev`) | Target Cloudflare environment |
|---|---|---|---|
| Baseline: dev, `next build`, OpenNext build, preview | PASS (OpenNext build needed `nodeLinker: hoisted` on Windows, §4) | PASS | BLOCKED (no account) |
| A. `proxy.ts` legacy redirects | PASS, 9/9 checks. OpenNext labels Node.js middleware **experimental and not maintained** | PASS, 9/9 | BLOCKED |
| A-alt. Custom Worker entry in front of OpenNext | PASS (redirects, Malayalam slug, D1 lookup, delegation to Next) | n/a (bypasses Next) | BLOCKED |
| B. D1 FTS5 trigram, Malayalam | PASS: trigram available; Malayalam needs normalisation (§6) | PASS | **Unverified.** Cloudflare documents FTS5 on D1, but not which tokenizers. **D1 export does not support databases that contain virtual tables** |
| C. R2 originals behind legacy resized-image URLs | PASS, 4/4 (local Images binding is a Sharp-based emulation) | PASS, 4/4 | BLOCKED: plan, billing and fidelity need the account |
| D. Better Auth + Drizzle + D1 (email/password + TOTP 2FA) | PASS, 12/12 | PASS, 12/12 (after a trailing-slash fix, §8) | BLOCKED. **CPU risk on the Workers Free plan** (scrypt) |

Totals from `node apps/web/spikes/run-spikes.mjs`: **25/25** on `http://localhost:8787` (preview) and **25/25** on `http://localhost:3000` (dev). With `ENABLE_SPIKES=0`, every spike route answered 404 and the home page answered 200.

---

## 2. Versions

Checked against the npm registry and the npm advisory database on 28 Oct 2026. Rule: pin exact versions, and use nothing published in the last 14 days (`minimumReleaseAge: 20160`) unless a security fix or a compatibility requirement forces it. Each exemption is listed in `pnpm-workspace.yaml`.

| Package | Pinned | Published | Why this version |
|---|---|---|---|
| Node.js | 22.23.2 (machine) | | Wrangler 4 needs ≥ 22; Next 16 needs ≥ 20.9. `engines: >=22.12 <23` |
| pnpm | 10.34.7 (Corepack) | 2026-10-12 | Releases before 10.34.5 have high-severity advisories (e.g. GHSA-c59q-g84q-2gj5, GHSA-vq4v-j7r6-jq4m). pnpm 11/12 exist but are new majors; not needed |
| next | 16.4.3 | 2026-10-23 | **Exempt.** next ≤ 16.4.0 has two critical RCE advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr) and one high DoS (GHSA-p3m5-59mp-jv5r) |
| eslint-config-next | 16.4.3 | 2026-10-23 | Exempt; must match `next` |
| react, react-dom | 19.3.1 | 2026-10-14 | Exempt. React shipped 19.0.9/19.1.10/19.2.9/19.3.1 on the same day as Next's security release, each with one "React Server Components: improve transport protocol" change. No advisory is published; treated as hardening |
| @opennextjs/cloudflare | 1.20.13 | 2026-10-21 | Exempt. The changelog says **1.20.12 is the first release supporting Next 16.4** (#1453). 1.20.13 fixes "Unknown chunk N" 500 errors (#1439), and its peer range requires `next >=16.4.1`. 1.20.11, the newest version older than 14 days, does not support 16.4 |
| @opennextjs/aws | 4.1.12 (transitive) | 2026-10-21 | Exempt; exact dependency of 1.20.13 |
| wrangler | 4.150.0 | 2026-10-13 | Satisfies OpenNext's peer `^4.148.0`. Its miniflare pins undici 7.29.1 (advisories, see §2.1); wrangler 4.154.0 (27 Oct) has undici 7.30.1 |
| better-auth | 1.7.7 | 2026-09-30 | Newest version older than 14 days; no advisories. Peer: `drizzle-orm ^0.45.2`, `drizzle-kit >=0.31.4` |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 | 2026-10-08 / 2026-09-21 | |
| typescript | 5.9.3 | 2025-09-30 | Kept on 5.x (7.0.2 is the new native compiler) |
| tailwindcss, @tailwindcss/turbopack | 4.3.3 | 2026-07 | `create-next-app@16.4.3` template |
| eslint | 9.39.5 | 2026-07-10 | `eslint-config-next` needs ≥ 9 |
| @types/node | 22.20.5 | | matches Node 22 |
| tsx | 4.23.15 | | `tools/migrate` |

### 2.1 `pnpm audit` (28 Oct 2026)

17 advisories (9 high, 8 moderate). **All are in local or build-time tooling**, not in code that runs in the Worker:

| Package | Path | Fixed in |
|---|---|---|
| undici 7.29.1 (9 advisories) | `wrangler > miniflare` (local dev server) | wrangler 4.154.0 (published 27 Oct; eligible under the 14-day rule from 10 Nov) |
| undici 6.x (5) | `@opennextjs/cloudflare > @dotenvx/dotenvx` (build CLI) | needs an upstream bump |
| glob 10.x, body-parser, qs | `@opennextjs/aws > @node-minify/core` / `express` (build CLI) | upstream |
| esbuild ≤ 0.24 | `drizzle-kit > @esbuild-kit/*` (dev server CORS issue; drizzle-kit does not run a server here) | upstream |

Recommendation: bump wrangler to ≥ 4.154 on or after 10 Nov 2026 (or exempt it now if preferred), and re-run `pnpm audit` before any deployment.

---

## 3. Environment and commands

- Windows 11 Home 10.0.26300, PowerShell and Git Bash, Node 22.23.2 (nvm-windows), Corepack 0.34.6, Git 2.55.0, Python 3.12.0.
- Project copied (not moved) from `C:\Users\shani\OneDrive\Desktop\gio-new` to `C:\dev\gio-kerala` with `robocopy /E /COPY:DAT /DCOPY:T`. SHA-256 of all 254 files compared: 0 differences. The OneDrive folder is unchanged and still exists.

Commands actually run (from `C:\dev\gio-kerala` unless noted):

```text
corepack enable pnpm
corepack prepare pnpm@10.34.7 --activate
git add -A && git commit                      # baseline 60c9d6c on main (24 files, reviewed first)
git switch -c phase-1/foundation-spikes
npx create-next-app@16.4.3 web --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-pnpm --skip-install --disable-git --no-react-compiler --yes   (in apps/)
pnpm install                                  # twice: before and after nodeLinker: hoisted
pnpm --filter web add better-auth@1.7.7 drizzle-orm@0.45.4 "@gio/db@workspace:*"
pnpm audit
pnpm --filter web cf-typegen                  # wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts
pnpm --filter @gio/db generate --name auth_tables      # drizzle-kit generate
pnpm --filter web exec wrangler d1 migrations apply DB --local
pnpm --filter web exec wrangler r2 object put gio-media-local/wp-content/uploads/2099/01/<synthetic>.png --local --file <scratch>
pnpm --filter web build                       # next build
pnpm --filter web build:cf                    # opennextjs-cloudflare build
pnpm --filter web preview:only                # opennextjs-cloudflare preview (wrangler dev, workerd) on :8787
pnpm --filter web dev                         # next dev on :3000
node apps/web/spikes/run-spikes.mjs http://localhost:8787
node apps/web/spikes/run-spikes.mjs http://localhost:3000
pnpm --filter web exec wrangler dev -c spikes/wrangler.custom-worker.jsonc --persist-to .wrangler/state --port 8788
pnpm --filter web exec wrangler deploy --dry-run --outdir <scratch>   # size measurement only; dry-run does not upload
pnpm typecheck                                # tsc --noEmit in web, @gio/db, @gio/migrate
pnpm lint
```

The two synthetic test images (1200×800 and 2560×1707 RGB gradients) were generated by `apps/web/spikes/make-test-png.mjs`. No client media was used.

---

## 4. Baseline: dev, build, OpenNext build, preview

| Check | Result | Evidence |
|---|---|---|
| `next dev` | PASS | `✓ Ready in 2.3s`; `GET /` 200 |
| `next build` | PASS | Turbopack, TypeScript OK, 2 static routes (before spikes) |
| `opennextjs-cloudflare build` | **FAIL, then PASS** | First run: `Error: EPERM: operation not permitted, symlink '...\.next\standalone\node_modules\.pnpm\@next+env@16.4.3\node_modules\@next\env' -> '...\.open-next\server-functions\default\node_modules\...'`. Cause: Windows needs Developer Mode or admin rights to create symlinks, and neither is on. Fix: `nodeLinker: hoisted` in `pnpm-workspace.yaml` (flat `node_modules`, no symlinks); after that the build passed |
| `opennextjs-cloudflare preview` | PASS | All bindings `local`; `GET /` 200, unknown path 404 |
| Worker size | 7,155 KiB raw / 1,511 KiB gzip | `wrangler deploy --dry-run`. Current Workers limits page: 64 MiB uncompressed on both plans, no compressed limit. OpenNext's troubleshooting page still quotes 3 MiB (Free) / 10 MiB (Paid) compressed; we are under both |
| `tsc --noEmit` (3 packages) | PASS | |
| `eslint` | PASS | after adding `.open-next/**`, `.wrangler/**`, `cloudflare-env.d.ts` and `spikes/**` to the ignores. Before that, ESLint reported 14,203 problems from build output; later it aborted (exit 134) and `tsc` took 6 minutes, because `spikes/custom-worker.ts` imports the generated `.open-next/worker.js` and `allowJs` pulled it into the program. `spikes/` is now excluded from `tsconfig.json` (Wrangler bundles that file itself); `tsc` is back to about 13 s |

OpenNext prints on every Windows build: *"OpenNext is not fully compatible with Windows. For optimal performance, it is recommended to use Windows Subsystem for Linux (WSL)."* Recommendation: local Windows builds are fine for development, but staging and production bundles should be built on Linux (CI or WSL).

### 4.1 Dev mode vs Cloudflare preview mode

| | `pnpm dev` (`next dev`, :3000) | `pnpm preview` (`opennextjs-cloudflare build && preview`, :8787) |
|---|---|---|
| Runtime | Node.js; Next's own dev server | `workerd` (the Workers runtime) through Wrangler; same bundle shape as production |
| Bindings (D1, R2, Images) | Local Miniflare emulation through `initOpenNextCloudflareForDev()` / `getCloudflareContext()` | Local Miniflare emulation (same `.wrangler/state`) |
| `.dev.vars` values | Only via `getCloudflareContext().env`, **not** `process.env` | Both `env` and `process.env` (OpenNext copies string vars) |
| Routing | Next.js router | OpenNext's re-implementation (`@opennextjs/aws` routing). Differs in details, e.g. trailing-slash redirects are **skipped for `/api/*`** (§8) |
| Hot reload | yes | no; rebuild needed (~1 min) |
| Use for | UI and feature work | anything touching routing, redirects, bindings, auth, caching, or before a merge |

---

## 5. Spike A: `proxy.ts` and legacy redirects

**Question:** does Next 16's `proxy.ts` (formerly `middleware.ts`, Node.js runtime) work under OpenNext Cloudflare 1.20, and can it carry the legacy-URL layer (`05` §6.1 step 7)?

Test code: `apps/web/src/proxy.ts` (disposable redirect table, synthetic Malayalam slug "പരീക്ഷണം"), plus `apps/web/spikes/custom-worker.ts` for the alternative.

| Check | Preview | Dev |
|---|---|---|
| exact path `/spike-legacy/old-path/` → 301 | PASS | PASS |
| Malayalam slug, lowercase percent-encoding (as WordPress emits) → 301 | PASS | PASS |
| Malayalam slug, uppercase percent-encoding → 301 | PASS | PASS |
| `/?p=999999` query rule → 301 | PASS | PASS |
| `/wp-login.php` → 410 | PASS | PASS |
| no trailing slash → 308 to slashed path (happens before proxy) | PASS | PASS |
| proxy runs on pass-through requests (header set) | PASS | PASS |
| proxy can query D1 through `getCloudflareContext()` | PASS | PASS |
| home page unaffected | PASS | PASS |

Findings:

1. **It works, but is not officially supported.** The build prints `WARN Node.js middleware support is experimental in cloudflare, and not officially maintained by OpenNext maintainers. Use at your own risk.` The source (`@opennextjs/cloudflare/dist/cli/build/open-next/bundle-node-middleware.js`) says it "re-bundles the middleware compiled by Next.js, which is an internal output that can change between Next.js versions."
2. Next 16's docs (`node_modules/next/dist/docs/.../proxy.md`): "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error." There is therefore no Edge-runtime fallback.
3. The supported alternative, a **custom Worker entry** that handles legacy URLs and then calls the OpenNext handler (https://opennext.js.org/cloudflare/howtos/custom-worker), was tested with `wrangler dev`: exact redirect 301, Malayalam-encoded 301, D1 lookup 200, and other paths delegated to Next (home 200). It runs before Next's routing, so it can also serve `/wp-content/uploads/*` without starting the Next server function. It does not run under `next dev`, so the redirect logic must live in a pure function with unit tests.

**Recommendation (needs your approval, because it changes `05` §6.1 step 7 from "middleware" to "Worker entry"):** put the legacy layer (exact `redirects`, pattern rules, `/wp-content/uploads/*` media) in a custom Worker entry ahead of OpenNext, built from one tested `resolveLegacyRequest()` module. Keep `proxy.ts` out of the critical path; at most use it for things like admin cookie pre-checks. If you prefer to stay on `proxy.ts`, pin Next and OpenNext exactly and re-run this spike on every upgrade.

---

## 6. Spike B: D1 FTS5 trigram search with Malayalam

Test code: `apps/web/src/app/spike/search/route.ts`. It runs on the D1 binding inside the runtime, creates throwaway FTS tables, and drops them. Synthetic test strings only.

### 6.1 Local results (identical in preview and dev)

Tokenizers that could be created: `trigram`, `trigram case_sensitive 0`, `trigram remove_diacritics 1`, `unicode61`, `unicode61 remove_diacritics 2`, `porter unicode61`: **all OK**.

Documents: 1 = "കേരള വിദ്യാർത്ഥി സമ്മേളനം" (atomic chillu ർ U+0D7C), 2 = the same word with the legacy chillu sequence ര + ് + ZWJ, 3 = "പൊതുപരിപാടി ഇന്ന്" (ൊ precomposed U+0D4A), 4 = "പൊതുയോഗം നാളെ" (ൊ decomposed U+0D46 U+0D3E), 5 = "GIO Kerala annual meet 2026".

| Query | Code points | Raw index MATCH | Raw LIKE | Normalised index MATCH | Normalised LIKE |
|---|---:|---|---|---|---|
| വിദ്യാർത്ഥി (atomic chillu) | 11 | [1] | [1] | **[1, 2]** | [1, 2] |
| same word, legacy chillu | 13 | [2] | [2] | **[1, 2]** | [1, 2] |
| സമ്മേ (partial word) | 5 | [1] | [1] | [1] | [1] |
| സമ് (partial word) | 3 | [1] | [1] | [1] | [1] |
| സമ (partial) | 2 | **[]** | [1] | **[]** | [1] |
| പൊതു (precomposed ൊ) | 4 | [3] | [3] | **[3, 4]** | [3, 4] |
| same, decomposed ൊ (NFD) | 5 | [4] | [4] | **[3, 4]** | [3, 4] |
| KERALA ANN (Latin, case) | 10 | [5] | [5] | [5] | [5] |

`highlight()` and `bm25()` work on the trigram table (`കേരള [വിദ്യാർത്ഥി] സമ്മേളനം`).

Findings:

1. **Trigram matching needs at least 3 code points.** Malayalam syllables are often 2-4 code points, so most real queries qualify. Shorter queries need a `LIKE` fallback, which works on the same table but scans it (fine at this content size).
2. **Unicode NFC alone is not enough.** NFC unifies ൊ precomposed and decomposed (`nfcEqualsForO: true`), but **not** the two chillu encodings (`nfcEqualsForChillu: false`). Both encodings occur in real Malayalam text. The candidate normaliser (`apps/web/src/lib/spike-ml-normalize.ts`) does NFC, then maps legacy chillu sequences to atomic chillus, removes the remaining ZWJ/ZWNJ, and lowercases. With it, every variant pair matched. It applies to the **search index and the query only**. Stored content and slugs are never rewritten (`05` §6.1 rule 5).
3. D1 blocks some SQL functions even locally: `SELECT sqlite_version()` gives `not authorized to use function: sqlite_version`. The exact SQLite version therefore cannot be read this way.

### 6.2 Target D1 (not verified)

- Cloudflare's D1 SQL docs: "D1 supports a subset of SQLite extensions … including the FTS5 module for full-text search (including `fts5vocab`)." **They do not name tokenizers.** Third-party write-ups use `tokenize='trigram'` on D1, which is encouraging but not authoritative.
- **Backup conflict:** D1's import/export docs say "Export is not supported for virtual tables, including databases with virtual tables. As a workaround, delete any virtual tables, export, and then recreate virtual tables." `05` §5.1 plans nightly D1 exports to `gio-private/backups/d1/`. An FTS5 table in the main database would make those exports fail.

**Recommendation:** keep the FTS5 index in a **separate D1 database** (binding e.g. `SEARCH`), rebuilt from the main database by a job. The main database then stays exportable, and the index can be dropped and rebuilt at any time. Store normalised text in it and keep the `LIKE` fallback for queries under 3 code points. Do not finalise this until a 5-minute check on a staging D1 confirms `tokenize='trigram'` works there (blocked on C1). The fallback in `05` §4 (`LIKE` on a normalised column) remains viable if trigram is missing.

---

## 7. Spike C: R2 originals behind legacy resized-image URLs

Test code: `apps/web/src/app/wp-content/uploads/[...path]/route.ts`. Synthetic images under the key prefix `wp-content/uploads/2099/01/` in the local `MEDIA` bucket.

| Check | Preview | Dev |
|---|---|---|
| original by exact R2 key → 200, 1200×800 PNG | PASS | PASS |
| `…/spike-test-300x200.png` → original resized through the Images binding → 300×200 PNG | PASS | PASS |
| `…/spike-photo-150x150.png` → no unscaled original, falls back to `spike-photo-scaled.png` → 150×150 | PASS | PASS |
| resized URL whose original is missing → 404 | PASS | PASS |

What the local test does **not** show:

1. **The local Images binding is an emulation.** Miniflare's `imagesLocalFetcher` runs Node's `sharp`. Cloudflare's docs: local mode is "a low-fidelity offline version", and "Currently, this version supports only `width`, `height`, `rotate`, and `format`". Output quality, `fit` behaviour and formats in production are unverified.
2. **Billing and plan.** "Calls to the Images binding are billed as unique transformations" (each source plus parameter combination counts once per calendar month). On the Free plan, 5,000 unique transformations a month are included, after which "New transformations will return a `9422` error". On Paid, $0.50 per 1,000 after the first 5,000. The client's plan is unknown (C1).
3. **Abuse and cost.** The spike route accepts any `-WxH`. In production it must only answer sizes WordPress actually generated (an allow-list from the importer's `media` rows or the uploads ZIP), and cache results (Cache API, or store derivatives in R2). Otherwise anyone can create unlimited unique transformations.
4. **Not byte-identical.** Resized output will not match WordPress's own files pixel for pixel. WordPress's square thumbnails are cropped (`fit: cover`), while its other sizes are proportional. Because the WxH in the filename is the exact output size WordPress produced, `cover` at those exact dimensions gives the same dimensions, but resampling differs. If exact copies matter, the alternative is to import WordPress's resized files from the uploads ZIP into R2 too (more storage, no transformations).
5. Zone-level Image Transformations (`/cdn-cgi/image/...` or `fetch(url, { cf: { image } })`) is a separate product that must be enabled on the giokerala.org zone. It cannot be tested locally.

**Recommendation:** keep the design in `05` §5.1 (originals and `-scaled` in R2, resized URLs mapped to the original). Serve it from the Worker entry recommended in §5 with a size allow-list and caching. Decide with the client whether to use the Images binding (needs the plan answer) or to store WordPress's resized files as-is (zero transformation cost, exact bytes, needs the uploads ZIP from C3).

---

## 8. Spike D: Better Auth + Drizzle + D1

Test code: `packages/db/src/schema/auth.ts` (Drizzle schema; migration `packages/db/migrations/0000_auth_tables.sql`, applied locally), `apps/web/src/lib/spike-auth.ts`, `apps/web/src/app/api/spike-auth/[...all]/route.ts`, `apps/web/src/app/spike/whoami/route.ts`. Each run creates one disposable user `spike-<timestamp>@example.test` in the **local** database. No email is sent.

| Check | Preview | Dev |
|---|---|---|
| sign-up (email + password) through the Drizzle adapter on D1 | PASS (590-673 ms) | PASS |
| server-side `getSession()` with `next/headers` | PASS (15-29 ms) | PASS |
| sign-in creates a new session | PASS (212-235 ms) | PASS |
| `GET /get-session` | PASS | PASS |
| wrong password → 401 | PASS | PASS |
| enable 2FA: TOTP URI + 10 backup codes | PASS | PASS |
| verify TOTP (code computed by the test, RFC 6238) | PASS | PASS |
| `twoFactorEnabled` true afterwards | PASS | PASS |
| sign-in with 2FA on → `twoFactorRedirect`, no session yet | PASS | PASS |
| second factor completes sign-in | PASS | PASS |
| sign-out revokes the session | PASS | PASS |
| `role` additional field defaults to `contributor` | PASS | PASS |

Implementation requirements found:

1. **Create the auth instance per request.** D1 bindings are request-scoped. `betterAuth({ database: drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }) })` inside the handler works. The Drizzle schema object keys must be Better Auth's model names (`user`, `session`, `account`, `verification`, `twoFactor`); table and column names can be snake_case.
2. **Trailing slashes.** `trailingSlash: true` (needed for legacy URLs) makes `next dev` 308-redirect `/api/auth/x` to `/api/auth/x/`. Better Auth's router then answers 404, because it requires an exact trailing-slash match. OpenNext's router skips that redirect for `/api/*` (`@opennextjs/aws/dist/core/routing/matcher.js`, "We should not apply trailing slash redirect to API routes"), so preview passed and dev failed. Fix used: `advanced: { skipTrailingSlashes: true }`. This is a concrete example of dev and Workers routing diverging.
3. **CPU time.** In the Worker bundle, passwords are hashed with `node:crypto` scrypt (N=16384, r=16, p=1, 64-byte key), confirmed in the built chunk. One hash or verify takes about 220-240 ms in Node on this machine. Cloudflare limits: **Workers Free 10 ms CPU per request**; Paid 30 s by default. Sign-up and sign-in will very likely exceed the Free limit. **Workers Paid is required for this auth design**, or a different credential scheme. Not measurable locally (workerd does not enforce CPU limits here).
4. TOTP secrets are stored encrypted (144-character value, not plain base32), keyed by `BETTER_AUTH_SECRET`. Rotating that secret needs a plan, or existing 2FA enrolments break.
5. Still to configure, not tested here: rate-limit storage (Better Auth's default in-memory store is per isolate on Workers; use database storage), `disableSignUp: true` with invite-only account creation, **mandatory** 2FA (Better Auth does not force enrolment; the admin layout must redirect users without `twoFactorEnabled`), password reset and email verification (need an email provider, decision C9), backup-code login, and Cloudflare Access in front of `/admin` (D3).
6. The schema follows `d1-schema-proposal.sql` (`user` with `role` and `is_active`, `two_factor`, ms timestamps). Better Auth 1.7's two-factor table also has `verified`, `failed_verification_count` and `locked_until`; the proposal should be updated to match. `role` is a TypeScript enum only; a SQL `CHECK` should be added with the real schema.

---

## 9. What was set up

| Path | What |
|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Workspace (`apps/*`, `packages/*`, `tools/*`), pnpm 10.34.7, 14-day release age with listed exemptions, `onlyBuiltDependencies: esbuild, workerd`, `nodeLinker: hoisted` |
| `apps/web/` | Next 16.4.3 App Router (Turbopack, Tailwind 4, `cacheComponents` on), `trailingSlash: true`, `wrangler.jsonc` (local-only bindings: `DB` with placeholder id, R2 `MEDIA`/`PRIVATE`/`NEXT_INC_CACHE_R2_BUCKET`, `IMAGES`, `WORKER_SELF_REFERENCE`), `open-next.config.ts` (R2 incremental cache), `.dev.vars.example`, `public/_headers`. **No `deploy` or `upload` script** |
| `packages/db/` | `@gio/db`: Drizzle auth schema, `createDb(d1)`, `drizzle.config.ts`, migration `0000_auth_tables.sql` |
| `tools/migrate/` | `@gio/migrate` placeholder CLI (prints "not implemented") |
| spike code | `apps/web/src/proxy.ts`, `src/app/spike/*`, `src/app/api/spike-auth/*`, `src/app/wp-content/uploads/*`, `src/lib/spike*.ts`, `apps/web/spikes/*`. All return 404 unless `ENABLE_SPIKES=1` is in `.dev.vars`. **Delete before real feature work** (listed in `src/lib/spikes.ts`) |

Local, git-ignored state: `apps/web/.dev.vars` (a random local `BETTER_AUTH_SECRET`), `apps/web/.wrangler/state` (local D1 with 3 disposable users; local R2 with 2 synthetic PNGs). Delete `apps/web/.wrangler/` to reset.

---

## 10. Unresolved risks

1. **D1 trigram tokenizer** availability in production (BLOCKED, C1).
2. **D1 export vs FTS5** virtual tables: design change proposed (§6.2).
3. **Workers CPU limit vs scrypt** on the Free plan (§8.3): the plan decision is needed.
4. **Node.js middleware on OpenNext is experimental** (§5): use a custom Worker entry instead.
5. **Images binding** fidelity, billing and quota in production (§7).
6. **Windows builds**: OpenNext warns it is "not fully compatible with Windows". Build deployable bundles on Linux.
7. **Dev vs Workers divergence** (env vars, `/api` trailing slashes): run `pnpm preview` and the spike suite before merging routing or auth changes.
8. Build-tool advisories (§2.1): low exposure, but track them.
9. `cacheComponents` is on (Next 16.4 default). Route handlers that read env at request time must call `await connection()`, or they are prerendered at build time. This happened to `/spike/whoami` until fixed.

---

## 11. Decisions and approvals needed

From the client (already listed in `04` §3.1, now with evidence):

- **C1, Cloudflare account and plan.** Needed for a staging D1/R2 to close risks 1, 3 and 5. Recommendation: **Workers Paid** (scrypt CPU, §8.3).
- **D1/D2/D3** confirmations still stand. Nothing found here argues against D1 + Workers/OpenNext + Better Auth, with the adjustments below.
- **Image handling:** Images binding (transformation billing, 5,000 a month free) versus storing WordPress's resized files from the uploads ZIP (C3).
- **C9, email provider:** needed before password reset and email verification can be built.

From you (developer decisions):

1. Approve the **custom Worker entry** for legacy redirects and media (changes `05` §6.1 step 7).
2. Approve a **separate D1 database for the search index** (changes `05` §4).
3. Keep or relax the 14-day rule for wrangler 4.154 (undici fixes).
4. Whether builds for staging should come from CI (Linux) rather than this Windows machine.
5. Delete the spike code before phase 2, or keep it on this branch only.

---

## 12. Recommended next development task

**"Legacy URL and media layer, local only":**

1. Add a custom Worker entry (`apps/web/worker.ts`) that calls a pure `resolveLegacyRequest(url, lookups)` module and then the OpenNext handler.
2. Implement exact redirects, the pattern rules from `05` §6.1 (including `?p=`, `?page_id=`, feeds, sitemaps, 410s), and `/wp-content/uploads/*` (exact key, `-scaled`, an allow-listed `-WxH`, caching).
3. Unit-test it against all 139 rows of `docs/audit/inventory/url_map.csv`: the 69 `same_path` rows pass through, and the 70 `pending_decision` rows produce **no** redirect.
4. Add a byte-exact test for the 34 Malayalam post URLs, then run it in `pnpm preview`.
5. Remove `proxy.ts` and the spike routes in the same change.

It needs no client data and no Cloudflare account, and it closes the highest-risk part of the architecture. In parallel, once C1 is answered, the 30-minute staging check covers trigram on D1, Images binding output, and a timed sign-in on the real Workers runtime.

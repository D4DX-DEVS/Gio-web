# Handoff report: legacy URL and media compatibility layer

I am rebuilding a website with an AI coding agent (Claude Code). Below is the status after the latest task. Please read it and tell me what I should do next.

## Project

- **Site:** giokerala.org (GIO Kerala, a Malayalam-language student/youth organisation). It currently runs on WordPress + Elementor.
- **Target stack:** Next.js on Cloudflare Workers (OpenNext), D1 + Drizzle, R2 for media, Better Auth + Cloudflare Access for the admin.
- **Ground rules:** never write to the live site; never invent or change content; keep every old URL; no secrets in git; nothing deployed until the client gives Cloudflare access.
- **Parallel work:** three Claude Code sessions work in separate git worktrees. This one did the legacy URL/media layer. Another built the content schema and WordPress importer (branch `phase-2/importer`). A third is building the public website and admin (branch `phase-3/website`).

## What this task did (28 Oct 2026, local only, branch `phase-2/legacy-url-layer`)

- **Adopted the phase-1 recommendation:** a custom Cloudflare Worker entry (`apps/web/worker.ts`) handles old WordPress URLs and `/wp-content/uploads/*` before Next.js. `proxy.ts` is no longer used; OpenNext labels it experimental.
- **Redirect logic** is a pure, unit-tested `resolveLegacyRequest()`:
  - URLs still pending a client decision are never redirected or removed.
  - Only explicitly approved rules redirect or return 410; there are none yet.
  - Pattern rules from the design doc: 410 for `wp-login.php`, `xmlrpc.php`, `wp-admin` and `wp-json`; `?p=` and `?page_id=` only for verified IDs; `?s=` goes to `/search/`; post and category feeds go to `/feed/`; WordPress sitemaps go to `/sitemap.xml`.
  - Malayalam slugs match in any percent-encoding, without Unicode normalisation.
  - Redirect loops, chains and unsafe targets are rejected; unknown URLs are never guessed.
- **Media handler:**
  - Serves the exact file from R2 first, including resized copies if they are ever stored.
  - Otherwise produces a resized image through the Cloudflare Images binding, but only for sizes that WordPress actually generated (4,571 from WordPress metadata) or that the old pages referenced (21). Any other size gets 404.
  - Prefers the `-scaled` original, then the unscaled original; skips sources over 20 MB.
  - Caches results: 1 year immutable, plus the Cache API for resized images. 404s cache for 5 minutes.
  - Never assumes a missing file exists. If resizing fails, it serves the real original with no-store.
  - Adds nosniff and sandbox headers.
- The redirect data and the image allow-list are generated from the audit CSVs and the frozen snapshot by a script, with input checksums and a `--check` mode.
- Removed `proxy.ts`, all spike routes and the `ENABLE_SPIKES` flag.
- Wrote `docs/architecture/LEGACY_URL_AND_MEDIA_LAYER.md` (decision, rules, caching, tests, production checks) and updated `docs/SETUP.md`.

## Test results

- Unit and audit tests: **81/81 pass** (Node's built-in test runner; no new dependency).
  - All 139 audited URLs: 69 verified keep their path; 70 pending produce no redirect and no 410 for GET, HEAD or POST.
  - All 34 post URLs byte for byte: the `?p=<id>` redirects equal the frozen URLs exactly.
  - The image allow-list equals WordPress's metadata.
- Local Workers preview (workerd): **195/195 end-to-end checks pass**. Normal pages still reach Next.js, and the spike routes are gone.
- Typecheck, lint, Next build and OpenNext build: pass. The "experimental Node.js middleware" warning is gone.
- **Not verified:** anything on real Cloudflare (no account yet), and the resize path end to end in workerd, because there are no real images in this worktree's local storage and we don't fake them.

## Discrepancies found in the source data

- "34 Malayalam post URLs": there are 34 post URLs, but only 17 have Malayalam slugs; 17 are ASCII. All 34 were tested byte for byte.
- `url_map.csv` stores decoded (UTF-8) paths, while `posts.csv` stores WordPress's lowercase percent-encoded URLs. Both forms are handled and tested.
- One resized image referenced by a theme-demo page (`event-14-370x270.jpg`) has no known original, so it returns 404.
- The 34 media items the WordPress API counts but does not list are not in the allow-list yet (needs the DB dump, WXR or uploads ZIP).

## Not done

No commit yet: changes are on branch `phase-2/legacy-url-layer`, waiting for my approval. No deploy. No client decisions applied (0 approved redirects). The layer does not run under `next dev`, only in `pnpm preview` and production.

## Pending decisions

- **Client:**
  - D4: what to do with the 70 pending URLs (redirect target or 410).
  - C1: Cloudflare account and plan.
  - C3: DB dump and uploads ZIP.
  - Image strategy: the Images binding (billed per unique transformation, 5,000 a month free) or storing WordPress's own resized files.
- **Me:**
  - Approve the commit.
  - Decide where client URL decisions will be recorded: a separate decisions file, or the importer's D1 `legacy_urls` table. `url_map.csv` is audit evidence and should not be edited.
  - Merge order of the three branches: legacy layer, importer, website.

## Recommended next step

Commit this branch. Then merge it into the website branch, so the demo runs on `pnpm preview` with real redirects and images. Add a small decisions file and loader, so client answers on the 70 pending URLs can be applied without editing audit files. Once Cloudflare access exists, run the production checklist in the architecture doc (§8) on a staging Worker.

## Questions for you (ChatGPT)

1. Is a separate decisions file (CSV, reviewed by the client) or the D1 `legacy_urls` table the better source of truth for redirect approvals before launch?
2. Should resized images use the Cloudflare Images binding, or should we import WordPress's own resized files from the uploads ZIP (exact bytes, no transformation cost)?
3. In which order should the three branches (legacy layer, importer, website) be merged, and what should be checked after each merge?
4. What exact instruction should I give the coding agent next?

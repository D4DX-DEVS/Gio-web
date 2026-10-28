# WordPress importer (`tools/migrate`)

Implements the pipeline in `docs/audit/05-MIGRATION-DESIGN.md` §3 for the sources available today: the frozen public snapshot (`migration/snapshot-2026-10-27/`) and `docs/audit/inventory/url_map.csv`. Everything runs locally. Nothing writes to the live WordPress site or to a Cloudflare account.

## Commands

Run from the repository root:

```powershell
pnpm install
pnpm --filter @gio/migrate exec tsx src/cli.ts build              # snapshot -> migration/staging/<snapshot>/bundle.json (offline)
pnpm --filter @gio/migrate exec tsx src/cli.ts files --dry-run    # show which files would be fetched
pnpm --filter @gio/migrate exec tsx src/cli.ts files --yes        # GET public uploads into migration/media-cache/ (once; cached files are skipped)
pnpm --filter @gio/migrate exec tsx src/cli.ts load               # bundle + cache -> local D1 + R2 (applies migrations first)
pnpm --filter @gio/migrate exec tsx src/cli.ts verify             # checks + migration/migration-reports/latest.md
pnpm --filter @gio/migrate exec tsx src/cli.ts all                # build + load + verify (does not fetch files)
pnpm --filter @gio/migrate test                                   # unit, build and load tests
```

Options: `--snapshot DIR`, `--bundle FILE`, `--cache DIR`, `--persist DIR` (default `apps/web/.wrangler/state`, the web app's local Miniflare state), `--out DIR`, `--dry-run` (for `load`: loads into a throwaway in-memory database).

`load` applies `packages/db/migrations` to the local database and records them in `d1_migrations`, the same way as `pnpm --filter web exec wrangler d1 migrations apply DB --local`. Either tool can be used afterwards.

## Steps

| Step | Module | What it does |
|---|---|---|
| build | `src/build.ts` | Runs the adapters (`sources/urlmap.ts`, `sources/rest.ts`, `sources/html.ts`), builds the complete file list (`media-index.ts`), turns PDFs into documents, generates the review queue (`review.ts`), validates the bundle with Zod (`model.ts`) and refuses to write it if it contains an API key |
| files | `src/files.ts` | Downloads each file once (GET, one at a time, 750 ms apart, identified User-Agent), checks Content-Length, records sha256, sniffed MIME and dimensions in `migration/media-cache/manifest.json`. A failed or 404 file is recorded as such, never as available |
| load | `src/load.ts` | Idempotent upserts into D1 in dependency order; puts cached files into local R2 (`gio-media-local`) at their byte-exact `wp-content/uploads/...` key with the sha256 in custom metadata; publishes the initial layout of each section page |
| verify | `src/verify.ts` | Compares the audit inventories, bundle, D1 and R2 and writes the report (also stored in local `gio-private-local/migration-reports/`) |

## Rules the importer follows

- **Idempotent.** Every record has a legacy key (`wp:post:2938`, `file:wp-content/uploads/...`, `html:leader:/team/#3`) in `import_items` with the hash of its source record. Unchanged source = skipped. Re-running creates no duplicates (tested).
- **Editors win.** If a row was edited in the new site after the last import, a changed source is **not** applied; an `import_conflicts` row is written instead. Rows deleted in the new site are not re-created. Rows that exist without an `import_items` entry are never touched. Client decisions on `review_items` and `legacy_urls` (`client_approved`) are never overwritten.
- **Imported as published.** Names, titles, dates and links are copied exactly. Suspected problems go to `review_items` with the published value and evidence; `suggested_value` is never filled by the importer.
- **Merge precedence** (05 §2.2) is `wp_sql > wp_wxr > wp_rest > html_parse`. With only `rest` and `html` sources the two do not overlap today, so the conflict list from merging is empty; the dump/WXR adapters (phase 6) plug into the same bundle.
- **Theme-demo content is not imported** (D4/D4b): the demo event, 2 demo venues, 3 demo tags, `/coming-soon/` and `/causes/` are listed in the bundle's `excluded` with the decision they wait on. All 139 URLs are in `legacy_urls`; the 70 pending ones create no redirects.
- **Secrets.** Google API keys (`AIza…`) are redacted from every stored value; the build and verify steps fail if one is found.

## Page reconciliation (REST counts 14 pages)

| WP id | Path | Imported as |
|---|---|---|
| 2074 | `/` | `sections` (9 homepage sections) |
| 280 | `/about-us/` | `sections` |
| 303, 1742, 2244 | `/team/`, `/district-leaders/`, `/former-leaders/` | `leaders` (scope state / district / former) |
| 2660, 2684, 526 | `/gio-news/`, `/gio-events/`, `/news-events/` | `post_listing` |
| 406 | `/contact-us/` | `sections` (form, contact details, keyless map embed) |
| 3424 | `/call-for-papers/` | `sections` |
| 3480 | `/tamkeen/` | `sections` (embed of tamkeen.rehours.com) |
| 2651 | `/events/` | not imported: empty page shadowed by the calendar (C7) |
| 319, 343 | `/coming-soon/`, `/causes/` | not imported: theme pages (D4) |

## Schema changes against `d1-schema-proposal.sql`

- CHECK constraints use unqualified column names (drizzle-kit's qualified form breaks table rebuilds).
- `media.file_status` (`available` / `missing`) and `media.legacy_sizes_json` (resized copies WordPress generated, for allow-listing legacy `-WxH` URLs).
- `pages.legacy_body_html` (raw imported HTML, as for posts and events).
- `legacy_urls.recommended_target` (advice from `url_map.csv`; never enforced until approved).
- `import_items.entity_updated_at` (detects editor changes between imports).
- `review_items.review_key` (unique, for idempotent re-imports), `title`, `decision_note`.
- Unique indexes on `source_ref` for sections, section items, leader groups, leaders and menu items; `documents.media_id` unique.
- `search_index` (FTS5) is **not** in the main database: D1 export does not support virtual tables. See `docs/architecture/PHASE_1_SPIKE_RESULTS.md`.

## Shared helpers for the web app (`@gio/db/layout`)

`publishPageLayout(db, pageId, by)` snapshots a section page's draft into `published_layouts`. `currentPageLayout(db, pageId)` returns what the public site renders. `mediaPublicPath(r2Key)` gives `/wp-content/uploads/...` for legacy files and `/media/<key>` for new uploads.

# GIO Kerala rebuild: migration design

- **Status:** proposal, 27 October 2026. Nothing has been implemented or deployed, and nothing on the live site has been changed.
- **Builds on:** `01-AUDIT-REPORT.md` (what exists), `02-ARCHITECTURE-PLAN.md` (stack and admin modules), `03-MIGRATION-CHECKLIST.md` (verification). Where this document differs from `02`, this document wins.
- **Companion files:**
  - `d1-schema-proposal.sql`: the full proposed D1 schema
  - `inventory/url_map.csv`: every one of the 139 audited URLs with its planned action
  - `inventory/missing_from_media_api.csv`: the 20 files the media API does not list
  - `04-STATUS-AND-DECISIONS.md`: project status, outstanding questions, verified vs approval-needed content

---

## 1. Architecture summary

The application architecture in `02-ARCHITECTURE-PLAN.md` §2 stands: Next.js (App Router) on Cloudflare Workers through `@opennextjs/cloudflare`, D1 for structured data, R2 for files, Better Auth plus Cloudflare Access for `/admin`, Turnstile on public forms.

This document adds the **migration architecture**: how WordPress data gets into D1 and R2 repeatably, from whichever source is available, without losing anything and without touching the old site.

```
 Sources (read-only)                Importer (local Node CLI, runs on our machine)               Targets
 ─────────────────────              ───────────────────────────────────────────────              ───────
 A. REST snapshot (have it)  ─┐
 B. WXR export (requested)   ─┤     1. extract   ─►  2. normalise  ─►  3. merge   ─►  4. load   ─► D1 (staging DB)
 C. MySQL dump (requested)   ─┼──►  per-source       to one staging     by legacy      SQL batches   R2 gio-media
 D. HTML/CSS snapshot (have) ─┤     adapters         bundle (JSONL,     key, record    + R2 PUTs     R2 gio-private
 E. File probe / uploads.zip ─┘                      Zod-validated)     conflicts                     (reports)
                                                                         │
                                                     5. verify ◄─────────┘  compares source ↔ D1 ↔ R2 ↔ rendered staging site
```

Principles:

1. **The import never reads the live site.** A separate, explicitly-run `snapshot` command fetches public data into `migration/snapshot-<date>/`. Every import run reads only from a frozen snapshot or from files the client sends, so results are reproducible and the live site sees no load during imports.
2. **One normalised format, many adapters.** Each source adapter produces the same staging bundle. Downstream steps do not care where a record came from, except to record provenance.
3. **Idempotent and re-runnable.** Every object has a stable `legacy_key` (`wp:post:2938`, `file:wp-content/uploads/2025/08/bnr1.jpg`, `html:leader:/team/#3`). Re-running updates in place; an unchanged content hash means skip.
4. **Nothing is silently dropped or corrected.** Content is imported exactly as published. Disagreements between sources go to `import_conflicts`; suspected errors go to `review_items` for the client. Theme-demo content is archived, not imported, until decision D4.
5. **Staging first.** Imports target a staging D1 database and staging R2 prefixes. Production is loaded only after the checklist passes and the client signs off.

---

## 2. Source adapters

| Adapter | Input | Provides | Cannot provide |
|---|---|---|---|
| `rest` | `migration/snapshot-*/rest/*.json` | posts (published only), pages, media metadata (301 of 335), categories, tags, TEC events/venues/organizers, Yoast SEO fields, authors (display name, slug) | drafts, private, scheduled, revisions, menus, Elementor JSON, 34 hidden media, settings |
| `wxr` | `Tools → Export → All content` XML | everything in `rest` plus drafts/private/scheduled posts and pages, attachments (including the hidden ones), `nav_menu_item`s, custom post types, postmeta (often including `_elementor_data`, `_wp_attached_file`, `_wp_attachment_metadata`) | plugin settings (`wp_options`), Elementor CSS, form submissions stored in custom tables, revisions (not exported by default) |
| `sql` | `.sql` / `.sql.gz` dump | everything: `wp_posts` (all statuses and revisions), `wp_postmeta`, `wp_terms*`, `wp_options` (menus locations, TEC and plugin settings), plugin tables (e.g. Royal Addons form submissions if stored) | files themselves |
| `html` | `migration/snapshot-*/html/*.html`, `css/*.css` | leaders (3 pages), homepage sections, header menu, contact details, CSS background images | anything not rendered publicly; link targets Elementor doesn't render |
| `files` | URL probe list **and/or** `wp-content/uploads` ZIP | bytes, size, sha256, sniffed MIME, dimensions | metadata (comes from the other adapters) |

### 2.1 How the SQL dump is read

The dump is loaded into a **throwaway local MariaDB container** (`docker run mariadb`) on our machine, never into anything public. The adapter:

- detects the table prefix (it may not be `wp_`) from `SHOW TABLES`;
- reads with a read-only user;
- treats `wp_posts.post_status` values `publish`, `future`, `draft`, `pending`, `private` as content, `inherit` + `post_type = revision` as revisions, `trash` and `auto-draft` as excluded-but-counted;
- reads `_elementor_data` JSON for pages 2074 (home), 303, 1742, 2244 (leaders), 3424, 3480, which gives exact widget order, link targets and attachment IDs instead of HTML guesses;
- reads `nav_menu_item` + `wp_term_relationships` + `theme_mods_*` for menus.

The dump stays in `gio-private/wp-source/<date>/` and on the developer machine only. It contains personal data (user emails, password hashes, possibly form submissions) and must not be committed to git.

### 2.2 Merge precedence

For a WordPress object found in several sources, per field: **`sql` > `wxr` > `rest` > `html`**. The exception is **rendered output**: what visitors see is the reference for verification, so the verifier compares the merged record against the public HTML and flags differences rather than trusting the database blindly (for example, an Elementor widget that is saved but hidden).

When two sources disagree on a field the importer keeps the higher-precedence value, writes an `import_conflicts` row with both values, and the run report lists it. A human resolves it.

### 2.3 Private and non-public WordPress data

The audit covered public data only. The adapters handle private data like this, and **each needs a client decision before anything is imported** (see `04-STATUS-AND-DECISIONS.md` §3):

| Data | Default handling |
|---|---|
| Draft / pending / scheduled / private posts and pages | Imported with the same non-public status, never published automatically. Listed in the run report. |
| Revisions | **Not** imported into D1. Raw rows archived in `gio-private` so nothing is lost. |
| Trash, auto-drafts | Counted in the report, archived raw, not imported. |
| Contact form submissions (if WordPress stores them) | Not imported until the client approves, because they are personal data. If approved: `contact_submissions.is_legacy = 1`, with a retention date. |
| WP user accounts | Never migrated as logins. Authors become bylines (`authors` table). New admin accounts are created by invitation. |
| Plugin settings (`wp_options`) | Archived raw; only specific values are used (TEC settings, timezone, permalink structure, site title). |

---

## 3. Pipeline steps

All steps are commands of one CLI (`pnpm migrate <step>`), with `--source`, `--run`, `--target staging|production` and a default `--dry-run`.

| Step | What it does | Output |
|---|---|---|
| `snapshot` | (Only step that touches the live site, and only with GET/HEAD.) Fetches REST collections with pagination, sitemaps, rendered HTML of every inventoried URL, Elementor CSS, and HEAD for every candidate file URL. Rate-limited, identifies itself in the User-Agent. | `migration/snapshot-<date>/` + manifest with sha256 of every file |
| `extract` | Runs the adapters for the sources present | `migration/staging/<run>/raw/*.jsonl` |
| `normalise` | Converts each raw record to the staging schema (Zod). Decodes entities, converts dates to UTC ms using the site timezone, decodes slugs, records `source` and `source_ref` | `staging/<run>/normalised/*.jsonl` |
| `merge` | Groups by `legacy_key`, applies precedence, records conflicts | `staging/<run>/merged/*.jsonl`, `conflicts.jsonl` |
| `transform` | Content clean-up that does not change meaning: strip `transliteration` spans (keep text), strip injected WP Social markup, rewrite resized image URLs to media references, sanitize HTML with an allowlist. Keeps the untouched HTML in `legacy_body_html` | `staging/<run>/final/*.jsonl` |
| `files` | Builds the full file list (§5.2), downloads or unzips each file, sha256, sniffs MIME, reads dimensions, uploads to R2 if the key is absent or the hash differs | `files.jsonl`, R2 objects |
| `load` | Upserts into D1 in dependency order: authors, media, categories/tags, pages, posts, venues/organizers/events, leader groups/leaders, sections/items, menus, settings, legacy_urls, redirects (approved rows only), review_items. Uses `import_items` for idempotency | D1 rows, `import_runs` row |
| `verify` | Runs the automated parts of `03-MIGRATION-CHECKLIST.md` against D1, R2 and the rendered staging site | `migration-reports/<run>/report.{json,html}` |
| `delta` | After the content freeze: new snapshot, import only objects whose WP `modified` is newer or whose hash changed | same as above |

---

## 4. Proposed D1 schema

Full DDL: **`d1-schema-proposal.sql`**. Summary of the tables and why they exist:

| Area | Tables | Notes |
|---|---|---|
| Identity and audit | Better Auth tables (+ `role`, `is_active` on `user`), `authors`, `audit_log`, `revisions` | WP authors are bylines, not logins |
| Media | `media`, `media_usage`, `documents` | one row per physical file, including WP's `-scaled`, unscaled and pre-edit originals (linked through `variant_of_media_id`). `media_usage` powers "where used" and blocks deleting files in use |
| Editorial | `posts`, `categories`, `tags`, `post_categories`, `post_tags`, `pages` | `legacy_body_html` keeps the raw imported HTML for verification |
| Page sections | `sections`, `section_items`, `published_layouts` | used by the homepage and every block-built page (§8) |
| Events | `events`, `venues`, `organizers`, `event_categories`, `event_category_map` | `report_post_id` links an event to its write-up |
| Leaders | `leader_groups`, `leaders` | groups reproduce the headings and order of the three leader pages; people are not merged |
| Navigation, settings | `menus`, `menu_items`, `site_settings` | social links are a menu (`key = 'social'`) |
| Forms | `contact_submissions` | `ip_hash` only, `purge_after` retention |
| URLs | `legacy_urls`, `redirects`, `not_found_log` | §6 |
| Migration | `import_runs`, `import_items`, `import_conflicts`, `review_items` | provenance, idempotency, conflict and client-approval queues |
| Search | `search_index` (FTS5, `trigram`) | trigram support on D1 to be confirmed with a spike before relying on it; fallback is `LIKE` on a normalised text column, which is fine at this content size |

Every content row carries `source`, `source_ref`, `import_run_id` and `review_state` (`verified` / `pending_client` / `client_approved`). That is how "verified content" and "content requiring client approval" stay separated inside the system, not only in documents.

---

## 5. Media migration strategy

### 5.1 R2 buckets and key layout

```
gio-media                                   public (custom domain, e.g. media.giokerala.org) + served at /wp-content/uploads/* by the Worker
├── wp-content/uploads/YYYY/MM/<exact WP filename>      legacy files, path byte-for-byte as on the old server
│                                                        (includes -scaled, unscaled originals and pre-edit originals)
├── images/YYYY/MM/<ulid>-<slug>.<ext>                  new uploads: post and page images, galleries
├── banners/YYYY/MM/<ulid>-<slug>.<ext>                 new uploads: hero slides, poster slider, page banners
├── leaders/<ulid>-<slug>.<ext>                         new uploads: leader photos
├── logos/<ulid>-<slug>.<ext>                           new uploads: programme logos, site logo, partner logos
└── documents/YYYY/<ulid>-<slug>.<ext>                  new uploads: PDFs and other documents

gio-private                                 no public access
├── snapshots/<date>/...                    frozen public snapshot used for imports (rest/, html/, css/, heads.json, manifest)
├── wp-source/<received-date>/              client-supplied db.sql.gz, export.xml, uploads.zip + sha256 manifest
├── archive/theme-demo/<date>/              raw HTML + REST JSON of the 61 demo URLs (kept until D4 is decided, and after)
├── archive/wp-private/<date>/              revisions, trash, plugin options extracted from the dump (raw)
├── migration-reports/<run-id>/             report.json, report.html, conflicts.jsonl
├── backups/d1/<env>/YYYY/MM/DD.sql.gz      nightly D1 export (cron Worker)
└── exports/contact-submissions/YYYY-MM.csv
```

A separate staging environment uses `gio-media-staging` / `gio-private-staging` with the same layout.

Rules:

- **Legacy keys are never renamed.** Keeping the WordPress path means every old image URL, including ones embedded in other sites and in social posts, keeps working with a direct key lookup.
- **New uploads get immutable keys** (`ulid` + ASCII slug of the original name). Replacing a file creates a new key and updates the `media` row, so caches never serve a stale file. The prefix (`images/`, `banners/`, ...) is chosen by the admin screen the upload comes from; D1 (`media.usage_hint`, `media_usage`) is the source of truth for where a file is used, so a logo reused as a banner does not need to move.
- **Folders in the admin media library are a D1 view, not R2 prefixes.** Legacy files therefore appear under "Banners", "Leaders", "Logos" etc. based on `media_usage`, while their keys stay legacy.
- **Resized WordPress copies** (`-300x200.jpg`, `-1024x683.jpg`, `-150x150.png`) are not stored. The Worker answers those URLs by mapping to the original and resizing with Cloudflare Image Transformations. `-scaled` files **are** stored because they are what WordPress treats as the attachment's main file and what posts link to.
- **No secrets in the browser.** Uploads go browser → Worker → R2 (or a short-lived presigned PUT for large PDFs). MIME is sniffed server-side; images ≤ 15 MB, PDFs ≤ 50 MB by default.
- **Integrity:** every object's sha256 is stored in `media.sha256` and checked by `verify`.

### 5.2 Building the complete file list

The media API alone is not enough. The `files` step takes the **union** of:

1. `source_url` of the 301 listed media items;
2. `media_details.original_image` of those items (WordPress's unscaled original): **35 items** have one;
3. pre-edit originals of the **6 items edited in WordPress** (filenames ending `-e<timestamp>`), whose unedited file stays on disk;
4. every `wp-content/uploads` URL referenced in rendered HTML (all 139 pages) and Elementor CSS;
5. when available: every `_wp_attached_file`, `_wp_attachment_metadata` (sizes, original_image) and `_wp_attachment_backup_sizes` from the dump/WXR, which covers the **34 media items the API counts but does not list**;
6. when available: every file in the uploads ZIP.

Each candidate is resolved, deduplicated by path, and fetched once. Status of what is known today:

| Group | Count | Status |
|---|---:|---|
| Files probed by the audit and reachable | 342 (≈363.7 MB) | in `asset_heads.json` |
| Already 404 on the live site (demo images) | 3 | recorded, not recoverable from live |
| Unscaled originals **not** probed by the audit, checked on 27 Oct (HEAD, read-only) | 10 reachable (≈56 MB), 1 `.heic` and 1 `.jpg` no response within the timeout | to add to the list |
| Pre-edit originals of 6 edited images (one confirmed: `2026/01/IMG_0926-scaled.jpg`, 200) | ≥ 6 | to probe in `snapshot` |
| Hidden media items (335 counted − 301 listed) | 34 | need DB dump / WXR / uploads ZIP |
| Files in uploads ZIP not referenced anywhere | unknown | need uploads ZIP |

So the "342 files / 364 MB" total in the audit is a **lower bound**; the true total is at least ~352 files / ~420 MB before the hidden items and the uploads archive.

### 5.3 The 20 publicly used files missing from the media API

Full list with live status and plan: **`inventory/missing_from_media_api.csv`**.

| Files | Used on | Live status | Plan |
|---|---|---|---|
| `2025/08/bnr1-5.jpg` (5 hero slides) | homepage (+ builder template 2102) | 200 | download by URL; media row `source = 'html_parse'`; hero carousel items |
| `2025/08/akshra.png`, `h-meet.png`, `herizon.png`, `nerinte.png`, `proteen.png`, `2025/09/Group-4.png` | homepage logo carousel | 200 | same; logo carousel items |
| `2025/09/madayi-case.png` | homepage image block | 200 | same; `image` section |
| `2025/08/bg-2.png` | homepage Elementor CSS background | 200 | same; `source = 'css_parse'`; recorded in `media_usage` as `css_background` |
| `2025/03/468209502_…_n.jpg` | GIO News page header (Elementor CSS) | 200 | same as above |
| `2020/10/shifana.jpg`, `2025/07/rizwana-.jpg` | `/former-leaders/` (+ demo `savelife_team`) | 200 | same; leader photos |
| `2025/08/naqaba1.jpeg` | Naqaba event page and event archives | 200 | same; event featured image |
| `2020/10/event-1.jpg`, `event-2.jpg`, `graph.png` | theme-demo pages only | **404** | cannot be recovered from the live site. Recorded in the report as missing; checked against the uploads ZIP if provided. They affect demo pages only |

**Correction to the audit:** the audit says the 20 files "download fine". 17 do; the 3 demo images above already return 404.

When the DB dump arrives, the importer matches these 17 files to attachment IDs via `_wp_attached_file`. If matched, `legacy_wp_id` is filled; if not, they stay as `html_parse`/`css_parse` media rows. They are migrated either way.

### 5.4 Known media issues (kept, flagged, not "fixed" silently)

- **Alt text:** none of the 301 media items listed by the API has `alt_text` (the audit said ≈296; it is all of them). `alt_text` stays NULL; the admin media module lists images without alt text for editors to fill. We do not generate alt text.
- **2 items labelled `text/xml`** (`2024/12/Copy-of-Thartheel-main-2.Still035*.jpg`): MIME is sniffed from bytes; `declared_mime_type` keeps the WordPress value.
- **The "HEIC" item (ID 3340)**: its served file is `IMG_0926-scaled-e1768740565344.jpg`; the original is `IMG_0926.heic`. All three physical files are kept as variants; the public site uses the JPEG.
- **Very large originals** (up to 25.8 MB, e.g. `2025/12/D4M02197.jpg`): stored as-is; delivery is resized by Image Transformations.

---

## 6. URL mapping and redirects

### 6.1 Strategy

1. **Keep paths identical** wherever the content survives: posts (`/<slug>/`), pages, category/tag archives, pagination, `/event/<slug>/`, `/events/...` views, `/feed/`, `/wp-content/uploads/...`. `trailingSlash: true`.
2. **Store every old URL** in `legacy_urls` with its action, target and approval state, generated from `inventory/url_map.csv` (139 rows today) and extended by importer-discovered URLs (drafts that get published later, attachment pages, URLs from the DB dump) and post-launch `not_found_log` entries.
3. **Only approved rows become redirects.** `pending_decision` rows produce nothing in `redirects`, so a URL waiting on the client keeps returning what we decide for staging (404 on staging) and is listed in the verification report until decided.
4. **Pattern rules** (code, not rows) for whole URL families:

| Pattern | New behaviour |
|---|---|
| `/wp-content/uploads/<path>` | R2 key lookup |
| `/wp-content/uploads/<name>-<W>x<H>.<ext>` | original via Image Transformations at that size |
| `/?p=<id>`, `/?page_id=<id>`, `/?attachment_id=<id>` | 301 to canonical URL via `legacy_wp_id` |
| `/<post-slug>/feed/`, `/category/<slug>/feed/` | 301 to `/feed/` (or category feed if built) |
| `/sitemap_index.xml`, `/*-sitemap.xml` | 301 to `/sitemap.xml` |
| `/?s=<q>` | 301 to `/search/?q=<q>` |
| `/wp-json/*`, `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php` | 410, no redirect into the new admin |
| `/feed/` | served (RSS 2.0, same item set) |

5. **Encoding:** Malayalam slugs are matched on the decoded UTF-8 string and on the lowercase-hex percent-encoded form WordPress emits. No Unicode normalisation is applied, because it could make two different slugs collide; a test checks all 34 post URLs byte for byte.
6. **Slug changes** in the new admin create a `redirects` row automatically (`origin = 'slug_change'`) and collapse chains so no redirect points to another redirect.
7. **Middleware order:** exact `redirects` match → pattern rules → content routes → 404 (logged to `not_found_log`).

### 6.2 Current mapping (from `inventory/url_map.csv`)

| Action | Rows | Types | Decision status |
|---|---:|---|---|
| `same_path` | 69 | 34 posts, 10 pages, `/news-events/` + 9 pagination URLs, 5 taxonomy archives, 8 event-archive views, 2 real events | verified |
| `pending_decision` | 70 | 61 theme-demo URLs, 4 author archives, 2 builder templates, `/coming-soon/`, `/causes/` (HTTP 500), the demo event | needs client approval |

For every pending row the CSV includes the recommended target (`savelife_team/*` and `team_cat/*` → `/team/`, demo event → `/events/`, author archives → `/news-events/`, everything else → `/`), or 410 if the client prefers. **No pending URL is dropped or redirected until the client approves**, and the raw content of all of them is archived in `gio-private` regardless of the decision.

---

## 7. Content verification

`03-MIGRATION-CHECKLIST.md` is the checklist; it has been updated with the items this design adds (section I). The `verify` step automates every row marked automatic and produces a per-run HTML report with: counts by entity (source vs D1), per-record field diffs, file sha256 matches, every `legacy_urls` row requested against staging with the expected status, open `import_conflicts`, and open `review_items`.

Launch gate: zero unexplained mismatches, zero unresolved conflicts, every `legacy_urls` row either verified or approved, and every `review_items` row decided (keeping as-is is a valid decision).

---

## 8. Admin: managing the homepage and other content

### 8.1 Homepage and section-built pages

The homepage, About, Contact, Call for Papers and Tamkeen are `pages` with `template = 'sections'`. Editors work in a **section builder**:

- the page's sections are listed in order with type, visibility, schedule and a preview thumbnail;
- **reorder** (drag), **show/hide**, **schedule** (`starts_at`/`ends_at`), **add** a section from the allowed types, **duplicate**, **delete** (soft, with revisions);
- each section type has its own form, validated by a Zod schema:

| Section type | Editor controls | Today's homepage block |
|---|---|---|
| `hero_carousel` | slides: image, optional link, alt text, caption, schedule; autoplay, interval | 1 (7 slides) |
| `image_banner` | image, link (URL, page or document), alt text | 2 (Call-for-Papers banner → PDF) |
| `image` | image, optional link, alt text | 3 and 5 |
| `rich_text` | TipTap editor (headings, lists, links), optional button | 4 (intro + Read More) |
| `instagram_feed` | handle, number of posts, mode (API / embed) | 6 |
| `poster_slider` | images in order, optional links | 7 (8 posters) |
| `featured_video` | YouTube URL or ID, title; privacy-enhanced embed | 8 (`GXMUeZOmWFs`) |
| `logo_carousel` | logos, optional links | 9 (6 logos) |
| `embed`, `map`, `contact_form`, `document_list`, `cta`, `latest_posts`, `upcoming_events` | type-specific | used by other pages or available as new options |

- **Draft and publish:** edits change the draft rows (`sections`, `section_items`). **Preview** renders the draft through Next.js draft mode. **Publish** validates every section, writes one `published_layouts` snapshot and marks it current, then purges the page cache. The public site reads only the current snapshot (one D1 read per page, easy to cache). **Rollback** marks an earlier snapshot current.
- **Media picker** inside every slide/image field: choose from the library or upload; alt text is requested at upload and per placement.

### 8.2 Other modules

As listed in `02-ARCHITECTURE-PLAN.md` §5 (posts, events, leaders, media, documents, navigation, settings, contact inbox, redirects, users, audit log), plus two additions from this design:

- **Review queue:** lists `review_items` (Q1-Q4 and other flagged items) with the published value, evidence link and buttons *Keep as is* / *Apply correction* (the correction text must be entered by an authorised person; the system never proposes names or spellings). Every decision is logged.
- **Legacy URLs:** lists `legacy_urls` by action and decision status; an admin approves a pending row by choosing 301 + target or 410, which creates the `redirects` row. Hit counts show which old URLs still get traffic.

Leaders module detail: groups (headings/terms) and entries are edited separately; drag-and-drop order within a group; "move this committee to Former Leaders" creates a new `former` group with the term label the editor types.

---

## 9. Recommended implementation order

Each phase ends with a check before the next starts. Phases 0 and 1 need no client input beyond D1; phase 2 onward needs the decisions in `04-STATUS-AND-DECISIONS.md`.

| Phase | Work | Exit check |
|---|---|---|
| 0. Decisions | Client answers the blocking questions (DB, demo URLs, private data, admin users, Cloudflare access); supplies DB dump / WXR / uploads ZIP if possible | written answers recorded in `04` |
| 1. Foundations | Next.js + OpenNext scaffold, Wrangler config for staging, D1 schema as Drizzle migrations, R2 staging buckets, CI (typecheck, lint, tests); spike: FTS5 trigram on D1, Image Transformations on R2 | empty staging site deploys; migrations apply cleanly |
| 2. Importer, read side | `snapshot` (re-run to pick up unprobed originals), adapters `rest`, `html`, `files`; `normalise`, `merge`, `transform` with unit tests on real snapshot records | staging bundle counts match audit counts |
| 3. Importer, write side + verify | `load`, `verify`, run report; full dry run then apply to staging | sections B, C, D of the checklist pass on staging |
| 4. Public site | layout, header menu, homepage from `published_layouts`, posts, pages, listings, leaders, events, contact, feed, sitemap, legacy URL middleware | section E and F pass; old-URL replay has 0 unexpected 404/500 |
| 5. Admin | auth + roles first, then media, posts, section builder, leaders, events, pages, menus, settings, contact inbox, review queue, legacy URLs, audit log | section G passes |
| 6. Private sources | when the dump/WXR/ZIP arrive: `sql`, `wxr`, uploads adapters; re-import; resolve conflicts; fill hidden media | B3, A5-A7 pass; conflicts resolved |
| 7. Client review | staging walkthrough, review queue decisions, pending URL decisions applied | every `review_items` and `legacy_urls` row decided |
| 8. Cutover | content freeze, `delta` import, full verify, production load, DNS/route switch, old origin kept on a private hostname | section H; E11/E12 re-checked after 7 days |

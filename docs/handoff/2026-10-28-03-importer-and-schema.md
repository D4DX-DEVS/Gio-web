# Handoff report: D1 schema and repeatable WordPress importer

I am rebuilding a website with AI coding agents (Claude Code). Below is the status after the latest task. Please read it and advise what I should do next.

## Project

- **Site:** giokerala.org (GIO Kerala, a Malayalam-language organisation site), currently WordPress + Elementor.
- **Target stack:** Next.js 16.4 (App Router) on Cloudflare Workers via `@opennextjs/cloudflare` 1.20, Cloudflare D1 (Drizzle ORM 0.45), Cloudflare R2 for media, Better Auth 1.7 + Cloudflare Access for the admin. pnpm workspace: `apps/web`, `packages/db`, `tools/migrate`.
- **Ground rules:** keep all verified content and old URLs, never invent or correct content without client approval, never write to the live WordPress site, nothing deployed and no Cloudflare account resources created.

## How the work is split

Three Claude Code sessions work in separate git worktrees of `C:\dev\gio-kerala` (moved out of OneDrive):

| Session | Worktree / branch | Scope |
|---|---|---|
| gio-new-6a | `C:\dev\gio-kerala`, `phase-1/foundation-spikes` (commit 3250241) | workspace, Next.js + OpenNext setup, Better Auth tables, phase-1 spikes |
| gio-new-12 (this report) | `C:\dev\gio-kerala-importer`, `phase-2/importer` (commit afd30ce, parent 3250241) | D1 content schema, importer, media migration, verification |
| gio-new-84 | `C:\dev\gio-kerala-web`, `phase-3/website` | public website + admin UI for tonight's demo |

All commits are local only; nothing is pushed.

## What this task did

- **D1 schema:** Drizzle schema for all 33 content tables from the proposal, plus migration `0001_content_schema.sql`. Small documented additions: a file-status column, the resized sizes WordPress generated per image, a raw imported-HTML column on pages, editor-change detection for re-imports, and a stable key for review items. The full-text search table is kept out of the main database, because D1 export does not support virtual tables.
- **Importer CLI** (`tools/migrate`) with four steps:
  - **build:** reads the frozen snapshot and `url_map.csv` and produces one validated bundle. It fails if any Google API key would be stored.
  - **files:** one-time GET of public `/wp-content/uploads/` files into a git-ignored local cache, recording sha256, MIME type and dimensions.
  - **load:** idempotent upserts into a local D1 database, and files into local R2 at their exact WordPress paths. It publishes the initial page layouts.
  - **verify:** checks the results and writes the migration report.
- **Re-import safety:**
  - Re-running creates no duplicates.
  - A record edited in the new admin is never overwritten; a conflict is logged instead.
  - Records deleted in the new site are not re-created.
  - Client decisions on review items and old URLs are kept.
- **Review queue:** 104 items, all with the published value and evidence, and never a suggested correction:
  - Untitled post: 1.
  - Back-dated posts: 7.
  - Social links shared between different people: 11.
  - Name spellings / reused photos: 3 + 2.
  - Empty leader slots: 3.
  - Unlinked hero slides and logos: 2.
  - Missing alt text (233 images): 1.
  - Unused library files and unlinked PDFs: 3.
  - Exposed Maps key: 1.
  - Old URLs waiting for a decision: 70.

## Verified results (local Miniflare D1/R2)

| Item | Result |
|---|---|
| Posts | 34 of 34 (titles and slugs match REST and the audit CSV; Malayalam URLs byte-identical) |
| Pages | 11 real pages; the REST count of 14 is reconciled (the empty `/events/` page and 2 theme pages are recorded as not imported, with reasons) |
| Leaders | 123 (29 state, 34 district, 60 former), names in published order equal to the audit inventory; people not merged |
| Events | 2 real events + venue + organizer; the demo event, 2 demo venues and 3 demo tags are not imported (waiting on decision D4) |
| Homepage | 9 sections (7 hero slides, banner linked to the PDF, 2 images, intro text, Instagram, 8 posters, YouTube video, 6 logos), published |
| Menus / settings | header menu 6 + 3 items, 4 social links; site name, phone, address, email, logo |
| Files | 359 files (413 MB): 301 media-library items + 35 unscaled originals + 6 pre-edit originals + 17 files used publicly but missing from the API. All downloaded, all in local R2 with matching sha256. The 3 audit-known 404 demo images are listed as unavailable |
| Old URLs | 139 in `legacy_urls` (69 same path, 47 linked to a record; 70 pending); **0 redirects** created |
| Secrets | 0 API keys stored (checked in bundle and D1) |
| Verification | 42 of 42 checks pass |
| Tests | 34 of 34 pass (helpers, sanitiser, real-snapshot build, load / re-import / editor-conflict / client-decision tests on an in-memory D1) |

## Not done / blocked

- Drafts, private posts, menus as stored in WordPress, Elementor JSON, revisions, and the 34 media items the API counts but does not list: these need the client's DB dump, WXR export or uploads ZIP (C3).
- Redirects for the 70 pending URLs need client decision D4.
- Search index: waiting for approval of the peer's proposal (a separate, rebuildable search database).
- Public site and admin: being built by session gio-new-84 against this schema.
- `apps/web` typecheck reports `LayoutProps` missing until Next.js generates its route types in a build. This belongs to the web package, not the importer.

## Questions for you (ChatGPT)

1. For tonight's demo, what is the most important thing to show the client from the migration side: the migration report, the review queue in the admin, or old-URL behaviour?
2. Should the review queue items (especially the 11 shared social links and the 7 back-dated posts) be sent to the client as a list now, before the demo, or walked through live?
3. Is it acceptable to keep the 85 unused media-library files (mostly theme-demo images) as hidden library items until the client decides (C6), or should they be held back from R2 entirely?
4. What exact instruction should I give the agents for the next step after the demo?

# Handoff: admin dashboard (local), 28 Oct 2026

**Project:** rebuild of giokerala.org (WordPress + Elementor) as a Next.js 16 app on Cloudflare Workers (OpenNext), with D1 (SQLite) for content, R2 for media, and Better Auth for admin login. Everything runs locally only. Nothing is deployed, and the live WordPress site was not touched.

**How the work is split today:** several Claude Code sessions work in parallel, each in its own git worktree. This report covers the admin dashboard in `C:\dev\gio-kerala-web` (branch `phase-3/website`). Session gio-new-84 owns the public website in the same tree and runs the dev server at http://localhost:3000. Session gio-new-12 built half of the admin modules. Session gio-new-6a is integrating everything on a separate branch.

## What this task did
- Admin login with Better Auth: email and password, no public sign-up, a 7-day session, and deactivated accounts refused. Accounts are created with a local-only script, `apps/web/scripts/create-admin.mjs`. The local owner account exists; its login is saved in a git-ignored file, `apps/web/.env.admin-login`.
- Shared admin shell: a sidebar layout, a server-side role guard on every page and action (owner > admin > editor > contributor), flash messages, audit-log rows on every write, form helpers (dates entered in India time, slugs that keep Malayalam), table, card and badge components, a confirm-before-delete button, and a media picker that loads the image library on demand.
- Dashboard: live counts, the pending client-review items grouped by code, recent posts and recent admin activity.
- Posts: list with search, status filter and pagination; create and edit (title, slug, excerpt, body HTML, status, publish date, featured image, categories, SEO title and description). The body HTML is sanitised on save. A revision snapshot is stored before each update. Delete is a soft delete (admin role only). Contributors can only save drafts or send posts for review.
- Pages and homepage: page details (title, slug, status, SEO) plus a section editor that edits the draft `sections` and `section_items` rows. Section fields: text HTML, settings JSON, visibility and order. Item fields: image, heading, text, link, alt text, visibility and order. A "Publish sections" button calls the importer's `publishPageLayout`, so the website changes only when someone publishes. A banner says when the draft has unpublished changes.
- Users (admin and owner only): add a person, change role, deactivate, and reset the password. Nobody can demote or deactivate themselves, and only an owner can grant the owner or admin role.
- gio-new-12 built leaders, events, media library and upload, documents, review queue, legacy URLs, menus, settings and the contact inbox on top of this shell.

## Verified
- Typecheck: `tsc --noEmit` reports 0 errors for the whole app.
- Login through the real form: a wrong password is refused, and the right password sets the session cookie and opens the dashboard.
- All 11 admin sections return HTTP 200 when signed in. The dashboard shows real data: 34 posts, 104 review items, 315 images.
- A throwaway post was created and saved twice through the real forms. The Malayalam slug was kept, `<script>` was stripped, and all fields survived the round trip. The test post was then deleted.
- The homepage at http://localhost:3000/ returns 200 with real GIO Kerala content.

## Incident (fixed)
An early test script did not send textarea and select fields. It blanked the body and excerpt of post #1 and set it to draft. The post was restored exactly from the editor's own revision snapshot (slug, body, excerpt, status, dates, image), and the test revision and audit rows were removed. The test script was fixed.

## Deliberately not done
- No "Publish" was clicked on any real page, so the published homepage snapshot is unchanged.
- No two-factor login and no Cloudflare Access. Both are needed before go-live.
- No rich-text (WYSIWYG) editor yet: the body is edited as HTML.
- Nothing was committed. Commits need the user's OK.

## Known problems
- The local dev server is very slow while several sessions run builds and imports at once. A first page load takes 10 to 40 s (one took 5 minutes). Database queries take 0.1 to 3 s. While files change there were short bursts of "Failed query" 500 errors that cleared up on their own.

## Questions for the next step
1. Should the next priority be a WYSIWYG editor for post and section text, or two-factor login plus Cloudflare Access?
2. Once the demo is approved, should the three worktrees be merged into one branch before more features are added?
3. Which staff roles does GIO Kerala need (how many editors, and do contributors need draft-only access)?
4. Should publishing a page require a second person to approve it (a review step), or is one editor enough?

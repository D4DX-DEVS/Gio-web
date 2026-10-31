# GIO Kerala rebuild: local demo guide (28 Oct 2026)

Everything here runs on this computer only. Nothing is deployed, and the live WordPress site at giokerala.org was never changed.

## Two ways to run it

Both run from the one project folder (`gio-kerala`, branch `main`). See the root `README.md` for first-time setup.

| What | Start command | Open |
|---|---|---|
| Public website **and admin dashboard** (development server) | `pnpm dev` | http://localhost:3000 and http://localhost:3000/admin/ |
| Public website as it will run on Cloudflare (Workers runtime, legacy URL and old-image layer) | `pnpm preview` | http://localhost:8787 |

`pnpm dev` takes a few seconds to start. The first visit to each page compiles it, which can take 10 to 30 seconds on this machine; later visits are fast. Open the pages you will show once before the presentation.

To stop a server, press Ctrl+C in its window. If port 8787 stays busy after stopping a preview, run `taskkill /F /T /IM workerd.exe`.

## Admin login (local only)

- URL: http://localhost:3000/admin/login/
- The only admin login is `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `apps/web/.dev.vars` (git-ignored). Database accounts cannot sign in, and there is no sign-up. Restart `pnpm dev` after changing the file.
- Two-factor: set `ADMIN_TOTP_SECRET` (make one with `node scripts/generate-totp-secret.mjs`) to require an authenticator code. Optional under `pnpm dev`; production builds, including `pnpm preview`, refuse to sign in without it.
- After 5 wrong attempts from one address (or 50 overall) sign-in answers HTTP 429 for 15 minutes.

## Suggested demo path (about 10 minutes)

1. **Homepage** (http://localhost:3000/): banner carousel from the old site, Call for Papers banner (opens the PDF), the Malayalam introduction, latest news cards, posters, events, the YouTube section, programme logos, footer with contact details.
2. **About Us** (`/about-us/`): original Malayalam text.
3. **Leaders**: `/team/` (state), `/district-leaders/`, `/former-leaders/` (timeline from 1984 to today).
4. **News**: `/gio-news/`, `/gio-events/`, `/news-events/`, then open a Malayalam post, for example `/കാൻവാസ്കാർഫ്/`. The old WordPress address works unchanged.
5. **Events**: `/events/` and `/event/thibyan25/`.
6. **Search**: `/search/?q=ഫലസ്തീൻ` or `/search/?q=Kannur`.
7. **Gallery** (`/gallery/`), **Documents** (`/documents/`), **Contact** (`/contact-us/`, the form saves to the admin inbox).
8. **Mobile**: narrow the browser window or use the phone view in developer tools (F12) to show the menu.
9. **Admin**: sign in, show the dashboard counts and the client-review queue, open a post, edit its title, save as draft or publish, then show it on the public site. Show leaders, events, media library (upload an image), settings and the contact inbox. Sign out.
10. **Old links** (on the Workers preview, http://localhost:8787, only): `/?p=2938` redirects to the Malayalam post `/കാൻവാസ്കാർഫ്/`; an old WordPress thumbnail name such as `/wp-content/uploads/2025/08/naqaba-90x90.jpg` is served by resizing the original. Check these once before the demo.

Tip: if you change content in the admin during the demo, it changes the local database only.

## What was migrated (local database, from the frozen 27 Oct 2026 snapshot)

| Content | Imported | Notes |
|---|---:|---|
| Posts | 34 | 26 GIO Events, 8 GIO News. 8 are flagged for client review (date or title questions) but stay published as on the old site |
| Pages | 11 | homepage, About, Contact, 3 leader pages, 3 news listings, Call for Papers, Tamkeen |
| Homepage and page sections | 17 sections, 27 items, 5 published layouts | |
| Leaders | 123 in 32 groups | state, district, and former leaders by term. 11 flagged for review: their social links are hidden on the public site until confirmed |
| Events | 2 | with venue |
| Media files | 359 | all 359 are present locally (about 413 MB), byte-checked |
| Documents | 3 | 1 published PDF, 2 drafts waiting for a client decision |
| Menus | 2 (13 items) | header and social links |
| Old URLs | 139 | 69 kept at the same address, 70 waiting for a client decision (no redirect is made for them) |
| Client review items | 104 | listed in the admin review queue |

Re-running the importer does not create duplicates (each record has a stable source key).

## Tests run today

- Public pages: 26 key routes return 200 on the dev server, including a Malayalam-slug post, the feed, sitemap and robots.txt; an unknown URL returns the 404 page.
- Old URL inventory (url_map.csv, 139 URLs) against the dev server: all 69 "same path" URLs return 200 (four old pagination pages were 404 and were fixed); all 70 "pending decision" URLs return 404 with no redirect.
- Legacy layer in the Workers preview (integration/demo, run by another session): 195/195 checks, unit tests 81/81, importer tests 34/34, OpenNext build passes.
- Admin: signed-out visits to `/admin/` redirect to the login page; public sign-up is refused (`EMAIL_PASSWORD_SIGN_UP_DISABLED`); sign-in works; all 12 admin sections return 200 when signed in; sign-out works and the admin is locked again.
- TypeScript: 0 errors. ESLint: clean on the public site and admin files.

## Outstanding

- **Client decisions:** the 70 old URLs waiting for a decision (author archives, theme demo pages), the 104 review items, the two draft PDFs, Cloudflare account and plan, email provider (password reset email), image resizing approach.
- **Source files still missing:** WordPress database export or uploads archive (34 media items the public API does not list; 3 demo images already deleted on the old site).
- **Before go-live:** two-factor login and Cloudflare Access for the admin, a rich-text editor (posts are edited as HTML today), spam protection (Turnstile) on the contact form, production Cloudflare resources.

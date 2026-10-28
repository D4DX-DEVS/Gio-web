# GIO Kerala rebuild: proposed architecture

Status: **proposal, not yet approved**. Nothing here has been implemented. Read alongside `01-AUDIT-REPORT.md` (what exists today) and `03-MIGRATION-CHECKLIST.md` (how we prove nothing was lost).

> **27 Oct 2026:** the schema (§3), R2 layout (§4) and migration pipeline (§6) are superseded by `05-MIGRATION-DESIGN.md` and `d1-schema-proposal.sql`. Open decisions are tracked in `04-STATUS-AND-DECISIONS.md`.

---

## 1. Decisions that need sign-off before implementation

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | Database | **Cloudflare D1** (SQLite) via Drizzle ORM | The brief says "expected to be D1, confirm first". D1 fits: content volume is small (≈35 posts, 14 pages, 123 leader entries, ≈335 media rows), it lives next to R2 and the Worker, and the site is already behind Cloudflare. Alternatives only worth it if you need heavy relational reporting or multi-region writes: Neon/Supabase Postgres via Hyperdrive. |
| D2 | Hosting runtime | **Cloudflare Workers via `@opennextjs/cloudflare`** | Gives Next.js direct bindings to D1 and R2. Cloudflare Pages + `next-on-pages` is the older adapter. Vercel would work but then D1/R2 become remote HTTP calls. |
| D3 | Admin authentication | **Better Auth** (email + password, mandatory TOTP 2FA for admins) stored in D1, **plus Cloudflare Access** in front of `/admin/*` | Two independent layers. Access can be the only layer if every admin has a Google/Microsoft account the org controls. |
| D4 | Theme-demo content (61 URLs, plus 9 related URLs, see audit §6 and `inventory/url_map.csv`) | **Do not migrate; 301 to closest real page or 410 Gone** | It is placeholder content ("Adam Clark" testimonials, "Visual Composer license key" FAQs, a "New York" marathon event). The brief forbids silent omission, so this needs explicit approval. |
| D5 | Language | Malayalam-first, with English where the source has it; **no machine translation** | The brief forbids inventing content. A future `locale` column is included so English versions can be added by editors later. |
| D6 | Comments | **Not carried over** (31 posts have comments open, 0 comments exist) | Nothing to migrate; re-enabling needs moderation tooling. |

---

## 2. Application architecture

```
                         ┌──────────────────────────── Cloudflare ────────────────────────────┐
 Visitor ──► DNS/CDN ──► │  Worker: Next.js (OpenNext)                                         │
                         │   ├─ Public site (App Router, RSC, ISR-style cache via KV/Cache API)│
                         │   ├─ /admin  (protected by Cloudflare Access + Better Auth)         │
                         │   ├─ /api/*  route handlers (uploads, forms, revalidate)            │
                         │   └─ middleware: legacy redirects, trailing slash, auth gate        │
                         │        │                 │                    │                     │
                         │        ▼                 ▼                    ▼                     │
                         │   D1 (content DB)   R2 gio-media (public)   R2 gio-private          │
                         │                     via media.giokerala.org  (backups, exports)     │
                         │                     + Image Transformations                         │
                         │   Turnstile (contact form)   Email: Cloudflare Email / Resend       │
                         └─────────────────────────────────────────────────────────────────────┘
```

### Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, React Server Components) |
| Styling / UI | Tailwind CSS + shadcn/ui (admin) ; custom components (public) |
| Fonts | Noto Sans Malayalam / Manjari for Malayalam, Inter for Latin, self-hosted via `next/font` |
| ORM / migrations | Drizzle ORM + drizzle-kit, migrations applied with `wrangler d1 migrations apply` |
| Rich text editor | TipTap (stores ProseMirror JSON **and** sanitized HTML); legacy posts import as sanitized HTML |
| Validation | Zod on every admin mutation and form |
| Images | R2 originals + Cloudflare Image Transformations through a custom `next/image` loader |
| Search | D1 FTS5 virtual table with the `trigram` tokenizer (works for Malayalam, which the default tokenizer splits poorly) |
| Forms / spam | Cloudflare Turnstile + rate limit per IP hash |
| Email notifications | Resend or Cloudflare Email Routing worker (contact form → `gio.kerala@gmail.com`) |
| Observability | Workers Logs, Sentry (optional) |
| Tests | Vitest (units), Playwright (public pages + admin flows + migration verification script) |

### Route map (public): existing URLs are preserved

WordPress uses `/%postname%/` permalinks with trailing slashes and percent-encoded Malayalam slugs. The new site keeps **identical paths** so search rankings and shared links survive. `trailingSlash: true` in `next.config`.

| Path | Source today | New implementation |
|---|---|---|
| `/` | Elementor page 2074 | `app/(site)/page.tsx`, built from `homepage_sections` |
| `/about-us/` | page 280 | `pages` table, slug `about-us` |
| `/team/` (State Leaders) | page 303 | `leaders` where `scope='state'` and `scope='state_council'` |
| `/district-leaders/` | page 1742 | `leaders` where `scope='district'` |
| `/former-leaders/` | page 2244 | `leaders` where `scope='former'`, grouped by term |
| `/gio-news/` | page 2660 (grid of category gio-news) | listing of `posts` in category `gio-news` |
| `/gio-events/` | page 2684 (grid of category gio-events) | listing of `posts` in category `gio-events` |
| `/news-events/` | WP posts page (all posts) | listing of all posts |
| `/category/{slug}/`, `/tag/{slug}/` | WP archives | taxonomy listing |
| `/{post-slug}/` | 34 posts | `app/(site)/[slug]/page.tsx` resolves posts first, then pages |
| `/events/`, `/event/{slug}/`, `/events/category/{slug}/` | The Events Calendar | `events` table |
| `/contact-us/` | page 406 + WPR form + map | page + `contact_submissions` |
| `/call-for-papers/` | page 3424 (banner + Zoho form link) | page with blocks |
| `/tamkeen/` | page 3480 (iframe of `tamkeen.rehours.com`) | page with `embed` block |
| `/feed/` | WP RSS | `app/feed/route.ts` RSS 2.0, same items |
| `/sitemap.xml`, `/robots.txt` | Yoast | generated by Next.js; old `/sitemap_index.xml` and `*-sitemap.xml` 301 → `/sitemap.xml` |
| `/wp-content/uploads/**` | WP media | served from R2 by the Worker at the **same path** (no broken hotlinks or embedded image URLs) |
| `/?p={id}`, `/?page_id={id}` | WP shortlinks | middleware looks up `legacy_wp_id` and 301s |

---

## 3. D1 database schema (Drizzle, SQLite)

All tables have `id INTEGER PRIMARY KEY`, `created_at`, `updated_at` (unix ms) unless noted. `legacy_*` columns record where each row came from so the migration can be re-run and verified.

### 3.1 Identity and audit

```sql
users            (id, email UNIQUE, name, role TEXT CHECK(role IN ('owner','admin','editor','contributor')),
                  is_active, last_login_at, ...)          -- Better Auth also creates session/account/verification tables
audit_log        (id, user_id, action, entity_type, entity_id, summary, diff_json, ip_hash, created_at)
revisions        (id, entity_type, entity_id, snapshot_json, user_id, created_at)   -- restore previous versions
```

### 3.2 Media and documents

```sql
media            (id, r2_key UNIQUE, original_filename, mime_type, byte_size, width, height, sha256,
                  alt_text, caption, title, credit,
                  folder,                                 -- 'legacy' | 'uploads' | 'documents'
                  legacy_wp_id, legacy_url UNIQUE,         -- e.g. https://www.giokerala.org/wp-content/uploads/2025/10/2-2.jpg
                  uploaded_by, ...)
documents        (id, media_id → media, title, description, category, published_at, status, sort)
                  -- brochure, call-for-papers book, etc. Gives PDFs a listing page and an admin home.
```

### 3.3 Editorial content

```sql
posts            (id, slug UNIQUE, title, excerpt, body_html, body_json, featured_media_id → media,
                  status CHECK(status IN ('draft','review','scheduled','published','archived')),
                  published_at, author_id → users, locale DEFAULT 'ml',
                  seo_title, seo_description, og_media_id,
                  legacy_wp_id UNIQUE, legacy_url, legacy_author_slug, ...)
categories       (id, slug UNIQUE, name, description, legacy_wp_id)
tags             (id, slug UNIQUE, name, legacy_wp_id)
post_categories  (post_id, category_id, PRIMARY KEY(post_id, category_id))
post_tags        (post_id, tag_id, PRIMARY KEY(post_id, tag_id))
post_media       (post_id, media_id, sort, role CHECK(role IN ('inline','gallery')))  -- every image a post uses
pages            (id, slug UNIQUE, title, template, status, published_at, seo_title, seo_description,
                  og_media_id, legacy_wp_id, ...)
page_blocks      (id, page_id → pages, type, data_json, sort, is_visible)
                  -- types: rich_text, image, image_carousel, leaders_grid, post_grid, embed, cta, map, form, pdf
```

### 3.4 Homepage (and any page) sections

```sql
homepage_sections (id, type, title, data_json, sort, is_visible, starts_at, ends_at)
  -- type ∈ hero_carousel | image_banner (optional link, e.g. Call-for-Papers PDF) | intro_text
  --        | instagram_feed | poster_slider | featured_video | logo_carousel
  --        | latest_posts | upcoming_events | documents          (the last three are new, optional)
  -- The 9 existing homepage blocks map 1:1 onto the first seven types; see audit §3.1.
slides            (id, section_id → homepage_sections, media_id, link_url, link_target, alt_text, caption,
                   sort, is_visible, starts_at, ends_at)
```

`starts_at` / `ends_at` let editors schedule banners (e.g. the "Call for Papers" banner) without code.

### 3.5 Events (from The Events Calendar)

```sql
venues     (id, name, address, city, district, state, country, map_url, legacy_wp_id)
organizers (id, name, phone, email, website, legacy_wp_id)
events     (id, slug UNIQUE, title, description_html, featured_media_id, starts_at, ends_at, all_day,
            timezone DEFAULT 'Asia/Kolkata', venue_id, organizer_id, cost, website_url,
            registration_url, status, linked_post_id → posts, legacy_wp_id, legacy_url, ...)
event_categories (event_id, category_slug)
```

### 3.6 Organisation data

```sql
leaders   (id, name, role_title, scope CHECK(scope IN ('state','state_council','district','former')),
           district, term_label, term_start_year, term_end_year, photo_media_id → media,
           facebook_url, instagram_url, sort, is_visible, legacy_source_url)
```

One person can appear in many rows (for example, the same President served several terms on `/former-leaders/`). Rows are kept exactly as published; we do not merge people.

### 3.7 Navigation, settings, forms, redirects

```sql
menus             (id, key UNIQUE)                           -- 'header', 'footer', 'mobile'
menu_items        (id, menu_id, parent_id, label, url, page_id, open_in_new_tab, sort)
site_settings     (key PRIMARY KEY, value_json, updated_by, updated_at)
                  -- site_name, tagline, logo_media_id, phone, address, email, social_links[],
                  --  map_embed, default_og_image, analytics_id, instagram_handle
contact_submissions (id, name, email, phone, message, page_url, ip_hash, user_agent,
                     status CHECK(status IN ('new','read','archived','spam')), created_at)
redirects         (id, from_path UNIQUE, to_path, status_code DEFAULT 301, hits, last_hit_at, note)
search_index      -- FTS5 virtual table (title, excerpt, body_text) USING fts5(tokenize='trigram')
```

---

## 4. Cloudflare R2 layout

Two buckets.

```
gio-media            (public through custom domain media.giokerala.org, also served at /wp-content/uploads/* by the Worker)
├── wp-content/uploads/2023/…/<original filename>     ← legacy originals, path kept byte-for-byte
├── wp-content/uploads/2024/…
├── wp-content/uploads/2025/…
├── wp-content/uploads/2026/…
├── uploads/YYYY/MM/<uuid>-<slugified-name>.<ext>     ← new admin uploads (images)
└── documents/YYYY/<uuid>-<slugified-name>.pdf        ← new PDFs / docs

gio-private          (no public access)
├── migration/2026-10-27/rest/*.json                  ← frozen source snapshot used for the import
├── migration/2026-10-27/html/*.html
├── migration/2026-10-27/wp-db-export.sql.gz          ← once provided by the client
├── backups/d1/YYYY-MM-DD.sql.gz                      ← nightly D1 export (cron Worker)
└── exports/contact-submissions/YYYY-MM.csv
```

Rules:

- Only **original** files go to R2. WordPress generated thumbnails (`-300x200.jpg`, `-1024x683.jpg`, `-scaled.jpg`) are **not** copied. Requests for those legacy URLs are answered by resizing the original via Image Transformations, so old embedded URLs still return an image.
- Every object records `sha256` in the `media` table; the migration checklist compares counts and hashes.
- Upload limits in admin: images ≤ 15 MB (jpg/png/webp/avif/heic → converted to webp/avif on delivery), documents ≤ 50 MB (pdf only by default). MIME sniffed server-side, not trusted from the browser.
- Uploads go **browser → Worker → R2** (or presigned PUT for large PDFs), never with R2 keys exposed to the client.

---

## 5. Admin dashboard modules

All under `/admin`, role-gated. Every save writes `revisions` and `audit_log`.

| Module | What editors can do | Roles |
|---|---|---|
| Dashboard | Recent changes, drafts awaiting review, new contact messages, broken-link report | all |
| **Homepage builder** | Reorder / show / hide / schedule sections; edit hero carousel, poster slider and logo carousel slides (image, optional link, alt, dates); banners; featured YouTube video; intro text; add new sections | admin, editor |
| News & Event reports (posts) | Create, edit, preview, schedule, publish, unpublish, delete (soft delete, 30-day trash); categories, tags; featured image; gallery; SEO fields; slug editing with auto-redirect when a slug changes | editor+ (contributor = draft only) |
| Events calendar | Create/edit events with dates, venue, organizer, cost, registration link; link an event to its post-event report | editor+ |
| Pages | Edit page blocks (About, Contact, Call for Papers, Tamkeen, etc.), create new pages | admin, editor |
| Leaders | State leaders, state council, district leaders, former leaders; drag to reorder; photo crop; "move current committee to Former" bulk action at term change | admin, editor |
| Media library | Upload (drag-drop, multi), search, alt text editing (≈296 legacy images have no alt text today), replace file, see where an item is used, block delete while in use | editor+ |
| Documents | Upload PDFs, title/description, show on site or not | editor+ |
| Navigation | Header / footer / mobile menus with nesting (e.g. "Our Leaders" dropdown) | admin |
| Site settings | Logo, contact phone/address/email, social links, map embed, Instagram handle, default SEO image | admin |
| Contact inbox | Read / archive / mark spam / export CSV | admin, editor |
| Redirects | List, add, edit; shows hit counts for legacy URLs | admin |
| Users & roles | Invite, deactivate, reset 2FA, change role | owner, admin |
| Audit log | Who changed what, when; restore a revision | owner, admin |

Security baseline: Cloudflare Access on `/admin/*` and `/api/admin/*`; Better Auth sessions (httpOnly, secure, SameSite=Lax); CSRF protection on mutations; Zod validation; HTML sanitization (DOMPurify / `sanitize-html` allowlist) on every rich-text save and on import; per-route role checks on the server, never only in the UI; rate limits on login and contact form; Turnstile on public forms; CSP headers; uploads MIME-sniffed; no secrets in client bundles.

---

## 6. Migration pipeline (to run after approval)

1. **Freeze a snapshot** (done for public data on 2026-10-27, see `migration/snapshot-2026-10-27/`). Add the WordPress database export and the full `wp-content/uploads` archive when the client provides them.
2. **Extract** with idempotent scripts (`scripts/migrate/*.ts`), inputs only from the snapshot, never from the live site during import:
   - posts, categories, tags, pages, media, events, venues, organizers → from REST JSON (or SQL export when available)
   - leaders → parsed from the rendered HTML of `/team/`, `/district-leaders/`, `/former-leaders/` (no structured source exists publicly; the SQL export would give the Elementor JSON)
   - homepage sections → parsed from page 2074 HTML + Elementor JSON when available
   - menus → parsed from header HTML (REST menu endpoints are closed)
3. **Transform**: strip `transliteration` spans (keep inner text), strip injected wp-social share markup, rewrite `wp-content/uploads/...-WxH.ext` to original-file references, decode entities, sanitize.
4. **Load**: upload originals to R2 (`wp-content/uploads/...` keys), insert rows into D1 with `legacy_*` columns.
5. **Verify**: automated script compares source vs D1 vs rendered new site (counts, titles, slugs, word counts, image counts, every URL returns 200 or the approved redirect). Results go into the checklist.
6. **Content freeze + delta**: announce a short editing freeze on WordPress, re-run steps 1-5 for anything modified after the snapshot (`modified` timestamps), then switch DNS (the domain is already on Cloudflare, so the cutover is a route change and the old origin can stay online, untouched, as a fallback).

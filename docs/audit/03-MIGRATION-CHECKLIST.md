# Migration verification checklist

Use this to prove that nothing was lost. Every line has an **expected value from the 27 Oct 2026 snapshot**. Fill in *Actual* and tick when they match. If a value changes because the client sends the database dump, update *Expected* and note the source.

Automated checks run with `scripts/verify-migration` (to be written in the implementation phase). Manual checks are marked 👁.

Legend: ☐ not checked · ☑ verified · ✖ mismatch (open an issue and link it)

---

## A. Pre-migration (inputs)

| # | Check | Expected | Actual | ✓ |
|---|---|---|---|---|
| A1 | Public snapshot saved (`migration/snapshot-2026-10-27/`) | REST JSON, 139 HTML pages, 16 Elementor CSS files | | ☑ |
| A2 | Database decision confirmed (D1 or other) | written approval | | ☐ |
| A3 | Demo-content decision (audit §6) | approved list: drop / redirect / keep | | ☐ |
| A4 | Data-quality corrections Q1-Q4 answered by client | each item: keep as-is or correct | | ☐ |
| A5 | WordPress DB dump received and loaded locally | `.sql.gz` in `gio-private/migration/` | | ☐ |
| A6 | `wp-content/uploads` archive received | file count ≥ 352 (342 probed + 10 unscaled originals found 27 Oct) | | ☐ |
| A7 | Contact-form submission storage confirmed and exported | count = ? | | ☐ |
| A8 | Old site left unchanged during audit and migration | no logins, no writes from our side | | ☐ |
| A9 | Content freeze date agreed with editors | date | | ☐ |

## B. Content counts (source → D1)

| # | Entity | Expected | D1 actual | ✓ |
|---|---|---:|---:|---|
| B1 | Posts (published) | 34 | | ☐ |
| B2 | Posts in `gio-events` / `gio-news` | 26 / 8 | | ☐ |
| B3 | Draft / private / scheduled posts | unknown until DB dump | | ☐ |
| B4 | Categories (`gio-events`, `gio-news`, `article`, `uncategorized`) | 4 | | ☐ |
| B5 | Tags in use (`waqf-act-2025`) | 1 (+3 demo tags per A3) | | ☐ |
| B6 | Pages migrated | 11 real (+ decisions on `/events/` page, `/coming-soon/`, `/causes/`) | | ☐ |
| B7 | Calendar events | 2 real (+1 demo per A3) | | ☐ |
| B8 | Venues / organizers | 1 real (WIRAS) / 1 (GIO Kerala) | | ☐ |
| B9 | Leaders: state | 29 | | ☐ |
| B10 | Leaders: district | 34 (17 units × President + Gen. Secretary) | | ☐ |
| B11 | Leaders: former | 60 (1984-1985 → "2026 - Ongoing..") | | ☐ |
| B12 | Homepage blocks | 9 (hero 7 slides, poster slider 8, logo carousel 6) | | ☐ |
| B13 | Header menu items | 9 (6 top-level, of which 1 dropdown with 3 children) + 4 social links | | ☐ |
| B14 | Site settings: phone, address, email, map | +91 871 44 02 748 · Hira centre, Mavoor road, Kozhikode, Kerala 673004 · gio.kerala@gmail.com · Hira Centre map | | ☐ |
| B15 | YouTube video on homepage | `GXMUeZOmWFs` | | ☐ |
| B16 | Users needing admin access | list from client | | ☐ |

## C. Per-item content fidelity (automated, every row)

For **each** post in `inventory/posts.csv`, page in audit §3.1, event, and leader in `inventory/leaders.csv`:

| # | Check | Rule | ✓ |
|---|---|---|---|
| C1 | Title | exact match after HTML-entity decoding (post 2577 has an empty title: keep empty unless Q1 says otherwise) | ☐ |
| C2 | Slug / URL path | byte-identical percent-encoded path | ☐ |
| C3 | Publish date, modified date | exact (Asia/Kolkata) | ☐ |
| C4 | Body text | normalised plain-text equality (whitespace collapsed, `transliteration` spans and share-widget markup removed); word count matches `posts.csv` | ☐ |
| C5 | Excerpt | exact | ☐ |
| C6 | Featured image | present and same original file (sha256) | ☐ |
| C7 | Inline images | same count and same files as `posts.csv → inline_images` | ☐ |
| C8 | Category / tags | same set | ☐ |
| C9 | SEO title and meta description | equal to `yoast_head_json.title` / `.description` | ☐ |
| C10 | Leader name, role, term/district, photo, social links | exact match to `leaders.csv` (including links flagged in Q3, unless corrected) | ☐ |
| C11 | Order of leaders on each page | same order as live site | ☐ |
| C12 | Event start/end, venue, organizer, description, image | exact | ☐ |
| C13 | External links inside content | same targets; none rewritten except internal `giokerala.org` links | ☐ |

## D. Media and documents (R2)

| # | Check | Expected | Actual | ✓ |
|---|---|---|---:|---|
| D1 | Original files uploaded to R2 | 342 reachable files + 10 unscaled originals + pre-edit originals (+ any extra from the uploads archive) | | ☐ |
| D2 | Files that 404 on live today (demo only) | 3: `2020/10/event-1.jpg`, `event-2.jpg`, `graph.png`; recorded, not migrated | | ☐ |
| D3 | Files missing from the media API but used on pages | 20 (`inventory/missing_from_media_api.csv`): 17 present in R2; 3 demo files (404 on live) recorded as missing unless the uploads archive has them | | ☐ |
| D4 | Unreferenced library items | 82, still migrated | | ☐ |
| D5 | sha256 of each R2 object equals source download | 100% | | ☐ |
| D6 | Total original bytes | ≈ 364 MB (± uploads-archive extras) | | ☐ |
| D7 | PDFs | 3: Call-For-Paper-Book-B2-FINAL_compressed.pdf, Call-For-Paper-Book-B2b-1.pdf, GIo-Brouchure_compressed.pdf | | ☐ |
| D8 | Alt text carried over where it exists | media API has none today (0 of 301); any found in the DB dump preserved; none generated | | ☐ |
| D9 | Elementor CSS background images | 4 files, used in new design or recorded as unused | | ☐ |
| D10 | Legacy URLs `/wp-content/uploads/YYYY/MM/file.ext` resolve | 200 for every row in `asset_inventory.csv` | | ☐ |
| D11 | Legacy resized URLs (`-300x200`, `-scaled`) resolve | 200 (served from the original) | | ☐ |
| D12 | HEIC upload is viewable | converted for display, original kept | | ☐ |

## E. URLs, redirects and SEO

| # | Check | Expected | ✓ |
|---|---|---|---|
| E1 | Every URL in `url_inventory.csv` of type `post`, `page`, `event`, `taxonomy-archive`, `event-archive`, `pagination` | HTTP 200 at the **same path** on the new site | ☐ |
| E2 | Every `theme-demo-cpt` / builder-template / approved-drop URL | 301 to the agreed target, or 410 (per A3) | ☐ |
| E3 | `/causes/` (500 today) | 301 or 410 per A3 | ☐ |
| E4 | `/?p=<id>` and `/?page_id=<id>` shortlinks for all 34 posts + pages | 301 to the canonical URL | ☐ |
| E5 | `/sitemap_index.xml` and all `*-sitemap.xml` | 301 → `/sitemap.xml`; new sitemap lists every E1 URL | ☐ |
| E6 | `/feed/` | valid RSS with the latest posts | ☐ |
| E7 | Canonical tags | self-referencing, `https://www.giokerala.org/...` | ☐ |
| E8 | `giokerala.org` → `www.giokerala.org` | 301 (same as today) | ☐ |
| E9 | `<html lang>` | `ml` (fixes Q8) | ☐ |
| E10 | Open Graph / Twitter tags per post | present; image = featured image | ☐ |
| E11 | Google Search Console | sitemap resubmitted, no new 404 spike after 7 days | ☐ |
| E12 | Old-site crawl replay: request all 139 old URLs on the new site | 0 unexpected 404/500 | ☐ |

## F. Functionality

| # | Feature | Pass criteria | ✓ |
|---|---|---|---|
| F1 | Header menu + "Our Leaders" dropdown, desktop and mobile | matches B13; keyboard accessible | ☐ |
| F2 | Hero carousel, poster slider, logo carousel | correct slides, order, swipe on mobile, pause control | ☐ |
| F3 | Call-for-Papers banner | opens the PDF | ☐ |
| F4 | Instagram feed | shows latest posts from `@gio_kerala` (or the approved fallback) | ☐ |
| F5 | YouTube video | plays; privacy-enhanced embed | ☐ |
| F6 | News / Events listings | same items and order as live; pagination works | ☐ |
| F7 | Events calendar | list, month and single views; `.ics` download | ☐ |
| F8 | Contact form | submission saved in D1, email delivered, Turnstile blocks bots, validation messages | ☐ |
| F9 | Maps | Hira Centre map renders; no unrestricted API key in page source (Q9) | ☐ |
| F10 | Tamkeen page | iframe loads `tamkeen.rehours.com` | ☐ |
| F11 | Call for Papers page | Zoho form link works | ☐ |
| F12 | Social share buttons on posts | Facebook, X, WhatsApp, copy link | ☐ |
| F13 | Site search | finds Malayalam and English terms (e.g. "നുഖബ", "Thibyan") | ☐ |
| F14 | Responsive | 360 px, 768 px, 1280 px, 1920 px: no horizontal scroll, readable Malayalam typography | ☐ |
| F15 | Accessibility | WCAG 2.1 AA spot check: contrast, focus, alt text where provided, landmarks | ☐ |
| F16 | Performance | Lighthouse mobile ≥ 90 performance on home, a post and a leaders page | ☐ |

## G. Admin dashboard

| # | Check | Pass criteria | ✓ |
|---|---|---|---|
| G1 | Access control | `/admin` blocked without Cloudflare Access + login; 2FA enforced for admins | ☐ |
| G2 | Roles | contributor cannot publish; editor cannot manage users; checked server-side | ☐ |
| G3 | Posts | create, edit, preview, schedule, publish, unpublish, trash, restore | ☐ |
| G4 | Slug change | automatically creates a 301 from the old slug | ☐ |
| G5 | Homepage builder | reorder, hide, schedule a slide; change visible on site after save | ☐ |
| G6 | Leaders | add, edit, reorder, move a committee to "Former" | ☐ |
| G7 | Media | upload image and PDF to R2; MIME checked; edit alt text; delete blocked while in use | ☐ |
| G8 | Events, pages, menus, site settings | full edit round-trip | ☐ |
| G9 | Contact inbox | list, read, archive, export CSV | ☐ |
| G10 | Revisions and audit log | every save recorded; restore works | ☐ |
| G11 | Backups | nightly D1 export lands in `gio-private/backups/`; restore tested once | ☐ |

## H. Cutover

| # | Step | ✓ |
|---|---|---|
| H1 | Content freeze on WordPress announced and started | ☐ |
| H2 | Delta import of anything with `modified` after the snapshot date | ☐ |
| H3 | Sections B-G re-run on the delta | ☐ |
| H4 | Client sign-off on staging URL | ☐ |
| H5 | Cloudflare route / DNS switched to the Worker | ☐ |
| H6 | Old WordPress origin kept online, unchanged, on a private hostname for 90 days as a fallback | ☐ |
| H7 | E11 and E12 re-checked 7 days after launch | ☐ |

## I. Additions from the migration design (27 Oct 2026)

See `05-MIGRATION-DESIGN.md` and `04-STATUS-AND-DECISIONS.md`.

| # | Check | Expected | ✓ |
|---|---|---|---|
| I1 | Every import run reads only frozen snapshots or client files, never the live site | `import_runs.source_label` is a snapshot or client file for every run | ☐ |
| I2 | Every content row has provenance | no row with empty `source` / `source_ref` | ☐ |
| I3 | Re-running the same import changes nothing | second run: 0 inserts, 0 updates | ☐ |
| I4 | `import_conflicts` resolved | 0 unresolved | ☐ |
| I5 | `review_items` decided | every Q1-Q4, Q10-Q12 row is `keep_as_is` or `change_approved`, with who and when | ☐ |
| I6 | `legacy_urls` complete | 139 audited rows + generated/pattern URLs; 0 rows left `pending_decision` at launch | ☐ |
| I7 | Theme-demo content archived before any decision is applied | raw HTML + JSON for all 61 demo URLs in `gio-private/archive/theme-demo/` | ☐ |
| I8 | WordPress file variants | every `-scaled` file, unscaled original (35 items) and pre-edit original (6 edited items) in R2 and linked by `variant_of_media_id` | ☐ |
| I9 | Hidden media items | 34 (335 counted − 301 listed) identified from the DB dump/WXR and migrated, or listed as unavailable | ☐ |
| I10 | Private WordPress data handled per decisions C4, C5, C10 | drafts imported non-public; revisions archived; submissions only if approved | ☐ |
| I11 | No personal data or client dumps in git | `git ls-files` contains no `.sql`, `.sql.gz`, `.zip`, `.xml` exports | ☐ |
| I12 | Section builder publish/rollback | publish creates a `published_layouts` snapshot; rollback restores the previous homepage | ☐ |

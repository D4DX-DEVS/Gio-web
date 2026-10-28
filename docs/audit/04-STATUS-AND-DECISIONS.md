# GIO Kerala rebuild: project status and outstanding decisions

- **Date:** 27 October 2026
- **Phase:** planning. No application code exists yet. Implementation starts only after the blocking decisions in §3 are answered.
- **Read with:** `05-MIGRATION-DESIGN.md` (how the migration works), `d1-schema-proposal.sql`, `inventory/url_map.csv`.

---

## 1. Current project state

Location: `C:\Users\shani\OneDrive\Desktop\gio-new`. Not a git repository.

| Path | Contents | State |
|---|---|---|
| `docs/audit/01-AUDIT-REPORT.md` | Audit of the live site (platform, URLs, content counts, data-quality issues, what needs admin/DB access) | complete; corrections in §2 below |
| `docs/audit/02-ARCHITECTURE-PLAN.md` | Stack, route map, first schema draft, R2 layout, admin modules, pipeline outline | proposal; superseded by `05` where they differ |
| `docs/audit/03-MIGRATION-CHECKLIST.md` | Verification checklist with expected values | proposal; section I added 27 Oct |
| `docs/audit/04-STATUS-AND-DECISIONS.md` | This file | new |
| `docs/audit/05-MIGRATION-DESIGN.md` | Migration architecture, schema summary, media and URL strategy, admin section builder, implementation order | new |
| `docs/audit/d1-schema-proposal.sql` | Full proposed D1 DDL | new, not applied anywhere |
| `docs/audit/inventory/*.csv` | `url_inventory` (139), `posts` (34), `leaders` (123), `asset_inventory` (322) | from the audit |
| `docs/audit/inventory/url_map.csv` | 139 old URLs with planned action and approval state | new |
| `docs/audit/inventory/missing_from_media_api.csv` | the 20 files the media API does not list | new |
| `migration/snapshot-2026-10-27/` | public REST JSON, 146 rendered HTML files, Elementor CSS, HEAD results for 345 file URLs (≈21 MB) | frozen evidence; do not edit |
| `migration/scripts-audit/*.py` | scripts that produced the snapshot and inventories | audit tooling |
| `migration/scripts-plan/build_url_map.py` | generates the two new CSVs from local files (no network) | new |

Nothing exists yet for: Next.js app, `package.json`, Wrangler config, Cloudflare resources, D1 databases, R2 buckets, credentials. No secrets are stored in the project.

Practical notes before implementation:

- **Move the code project out of OneDrive** (or exclude it from sync). `node_modules` and `.next` inside a synced folder cause slow installs and file-lock errors on Windows.
- **Initialise git and keep the repository private.** The snapshot HTML contains the Google Maps API key that the live site already exposes publicly (Q9). It is not our secret, but it should not be republished; the key owner should restrict or rotate it.
- The client's DB dump and uploads ZIP, when they arrive, contain personal data and must stay out of git (store in `gio-private` R2 and locally only).

---

## 2. Corrections to the audit found during this review

Checked against the snapshot files and, for item 3, a read-only HEAD request to 12 file URLs on 27 Oct.

| # | Audit statement | What the data shows | Effect |
|---|---|---|---|
| 1 | The 20 files missing from the media API "download fine" | 17 return 200. **3 return 404** (`2020/10/event-1.jpg`, `event-2.jpg`, `graph.png`); they are used only on theme-demo pages | Only 17 are recoverable from the live site; the 3 can only come from the uploads ZIP |
| 2 | ≈296 images have no alt text | **All 301** media items listed by the API have empty `alt_text`; the asset inventory has 0 alt texts | Nothing to carry over; editors fill alt text later |
| 3 | 342 reachable files, ≈364 MB | The audit did not probe 11 unscaled originals (`media_details.original_image`) or the pre-edit originals of 6 edited images. 10 of those 11 returned 200 (≈56 MB); `IMG_0926.heic` and `DSC00819.jpg` gave no response in time; one pre-edit file confirmed | True total is **at least ≈352 files / ≈420 MB**, before the 34 hidden media items and the uploads archive |
| 4 | `02` §1: "≈80 leader records", "≈55 URLs" of demo content | Inventories: **123** leader entries, **61** theme-demo URLs (70 URLs need a decision in total) | `02` text corrected |
| 5 | `03` A6: uploads archive "≥ 345 originals" | 3 of the 345 are already 404 | expectation corrected to "≥ 352 files" |
| 6 | The "HEIC" media item | Served file is `IMG_0926-scaled-e1768740565344.jpg`; the `.heic` is the original | Public site uses the JPEG; all variants kept |
| 7 | "2 calendar events" (brief) | REST has **3**: 2 real (Naqaba, Thibyan '25) + 1 theme demo | consistent; demo event is in the pending list |

---

## 3. Outstanding decisions and questions

### 3.1 Blocking: needed before implementation starts

| # | Question | Our recommendation | Blocks |
|---|---|---|---|
| D1 | Confirm the database is **Cloudflare D1** | D1 (content is small; sits next to R2 and the Worker) | schema, phase 1 |
| D2 | Hosting runtime: Cloudflare Workers via OpenNext | yes | phase 1 |
| D3 | Admin authentication: Better Auth (email + password + mandatory 2FA) **plus** Cloudflare Access on `/admin` | yes; Access alone is possible if every admin has an organisation-controlled Google/Microsoft account | admin |
| C1 | **Cloudflare account**: who owns the account that proxies giokerala.org, and can we get a scoped API token / member access for a separate staging environment? | member access with Workers, D1, R2 permissions; no DNS changes until cutover | phase 1 |
| C2 | **Admin users**: names, emails and roles (owner / admin / editor / contributor) | at least 2 owners so access is never lost | admin |
| C3 | Can the client supply a **database dump** (preferred) or **WXR export**, and a **ZIP of `wp-content/uploads`**? | yes to dump + ZIP; it is the only way to get drafts, menus, Elementor data, the 34 hidden media items and the 3 lost demo files | phase 6 (not phase 1-5) |

### 3.2 Needed before the import is applied to staging

| # | Question | Recommendation |
|---|---|---|
| D4 | **Theme-demo URLs (61) + demo event, `/coming-soon/`, `/causes/` (HTTP 500), 2 builder templates**: for each, 301 to which page, or 410? | recommended targets are in `url_map.csv`; raw content archived either way |
| D4a | **Author archives** (`/author/gioadmin/`, `/author/gioeditor/` + pages) | 301 to `/news-events/` |
| D4b | Demo tags (`charity`, `donation`, `poor`) and demo venues ("New York", "121 Kings St. NY") | not imported |
| C4 | **Drafts, private and scheduled posts** (unknown until dump): import as non-public drafts? | yes, never auto-published |
| C5 | **Revisions**: archive only, or also make them restorable in the new admin? | archive only |
| C6 | **82 unused library files** and the 2 unlinked PDFs (Call-For-Paper-Book-B2b-1.pdf, GIo-Brouchure_compressed.pdf): migrate as hidden library items? Should the brochure be published on a Documents page? | migrate all as hidden; client decides on publishing the PDFs |
| C7 | Empty `/events/` WordPress page (shadowed by the calendar archive) | not migrated as a page; `/events/` stays the calendar |
| C8 | `/news-events/` duplicates `/gio-news/` + `/gio-events/` (Q7). Keep all three listings? | keep all three paths; they cost nothing |

### 3.3 Data-quality questions for the client (published content is kept as-is until answered)

| # | Question | Evidence |
|---|---|---|
| Q1 | Post 2577 (`/2577-2/`) has no title and seems to cover the same story as Malayalam post 2719. Give it a title? Keep both? | `posts.csv` |
| Q2 | Event reports have back-dated publish dates (2013-01-03, 2013-02-03, 2014-01-03 …, entered Nov 2025). Are these the real event dates? | `posts.csv` |
| Q3 | Social links on `/team/` that seem to belong to a different person (Farhana Jabbar → `shamnamadathil`, Afra Nasar → `faseela_jabbar_`, CM Rafeea Facebook → `safeeda.hussain`). Please give the correct links, or confirm. | `leaders.csv` |
| Q4 | Name spellings differ between pages ("RISVANA SHIRIN H" / "Rizwana Sherin", "AYSHA GAFOOR" / "AYISHA GAFOOR", "AFRA SHIHAB ES" / "AFRA SHIHAB"). Which spelling is correct, per person? | leader pages |
| Q10 | 3 empty team-member widgets (1 on `/team/`, 2 on `/district-leaders/`): positions to fill, or remove? | live pages |
| Q11 | Hero slides and logos have no links today. Should any link somewhere? | homepage |
| Q12 | `shifana.jpg` and `rizwana-.jpg` are used on `/former-leaders/` and (demo) `savelife_team`. Confirm these are the right photos for the former-leaders entries. | `missing_from_media_api.csv` |

We will not correct any name, date, link or title without a written answer from the client.

### 3.4 Needed before launch

| # | Question | Recommendation |
|---|---|---|
| C9 | Where do **contact form messages** go today (email address? stored in WordPress?) | new form: store in D1 + email to the address the client confirms |
| C10 | If WordPress stores old submissions: import them? Retention period? | import only with approval; set a retention period (e.g. 24 months) under India's DPDP Act |
| C11 | **Instagram feed**: can the account owner connect a Meta app (live API), or accept an embed / static fallback? | API if possible |
| C12 | **Tamkeen** iframe (`tamkeen.rehours.com`) and **Zoho** Call-for-Papers form: confirm both stay external | keep as embed / link |
| C13 | Language: set `lang="ml"`; any English versions of pages wanted later? | Malayalam-first; no machine translation |
| C14 | Analytics: none today. Add privacy-friendly analytics (Cloudflare Web Analytics)? | yes, cookieless |
| C15 | Google Search Console access for the sitemap resubmission and 404 monitoring | grant to the developer |
| C16 | Content-freeze date on WordPress and launch window | agree 2 weeks ahead |
| C17 | Google Maps API key exposed on the Naqaba venue page (Q9): the key owner should restrict it to the domain or rotate it. The new site uses keyless embeds. | client action |
| C18 | Who keeps the old WordPress origin online (private hostname) for 90 days after launch? | client hosting |

---

## 4. Verified content vs content requiring client approval

### 4.1 Verified: migrate exactly as published (no approval needed beyond the overall plan)

| Content | Count | Source |
|---|---:|---|
| Posts: title, slug, dates, body, excerpt, category, tag, featured and inline images, Yoast SEO title/description | 34 (26 gio-events, 8 gio-news) | REST |
| Categories / tags in use | 4 categories (2 used) / 1 tag (`waqf-act-2025`) | REST |
| Pages: Home, About Us, State Leaders, District Leaders, Former Leaders, GIO News, GIO Events, News, Contact Us, Call for Papers, Tamkeen | 11 | REST + HTML |
| Calendar events: Naqaba camp (3-6 Sep 2025, WIRAS), Thibyan '25 (26 Dec 2025) + venue WIRAS + organizer | 2 + 1 + 1 | REST (TEC) |
| Leader entries **as published** (names, roles, terms, photos, links) | 123 (29 state, 34 district, 60 former) | HTML |
| Homepage composition and order | 9 blocks (7 hero slides, 8 posters, 6 logos, YouTube `GXMUeZOmWFs`) | HTML |
| Header menu | 6 top-level items, 1 dropdown with 3 children, 4 social links | HTML |
| Contact details | phone, address, email, Hira Centre map | HTML |
| PDFs | 3 | REST media |
| Reachable files | 342 probed + 10 unscaled originals confirmed 27 Oct | HEAD checks |
| URLs kept at the same path | 69 | `url_map.csv` |

"Verified" means it matches public evidence. It does not mean the content is correct; items flagged in §3.3 are imported as published **and** marked `review_state = 'pending_client'`.

### 4.2 Requires client approval or input

| Content | Count | Decision ref |
|---|---:|---|
| Theme-demo URLs and their redirect targets | 61 | D4 |
| Demo event, `/coming-soon/`, `/causes/`, builder templates, author archives | 9 URLs | D4, D4a |
| Demo tags and venues | 3 + 2 | D4b |
| Untitled / possibly duplicate post 2577 | 1 | Q1 |
| Back-dated event report dates | several (see `posts.csv`) | Q2 |
| Suspected wrong social links | ≥ 3 leaders | Q3 |
| Name spelling differences | ≥ 3 people | Q4 |
| Empty leader widgets | 3 | Q10 |
| Leader photos also used by demo pages | 2 | Q12 |
| Unused library files and unlinked PDFs: publish or keep hidden | 82 + 2 | C6 |
| Drafts, private posts, revisions, contact submissions (not yet seen) | unknown | C4, C5, C10 |
| 3 demo images already lost on the live site | 3 | C3 (uploads ZIP) |
| 34 hidden media items | 34 | C3 |

---

## 5. What we will not do without explicit approval

- change, log in to, or write to the live WordPress site (only read-only GET/HEAD requests, rate-limited);
- delete, redirect or recreate any theme-demo URL;
- correct any name, title, date or social link;
- publish any draft, private or previously unlinked content;
- import contact-form submissions or any other personal data;
- change DNS or Cloudflare settings for giokerala.org;
- generate alt text, translations or any other content that does not exist today.

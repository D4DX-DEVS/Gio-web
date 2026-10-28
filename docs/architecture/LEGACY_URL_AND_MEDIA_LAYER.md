# Legacy URL and media layer

- **Date:** 28 October 2026
- **Branch:** `phase-2/legacy-url-layer` (from `phase-1/foundation-spikes` @ `3250241`)
- **Status:** implemented and tested **locally only**. Nothing is deployed. Production Cloudflare behaviour is **not verified** (§8).
- **Code:** `apps/web/worker.ts`, `apps/web/src/legacy/`, `apps/web/scripts/generate-legacy-data.mjs`, `apps/web/scripts/check-legacy-preview.mjs`
- **Builds on:** `docs/audit/05-MIGRATION-DESIGN.md` §5-6, `docs/architecture/PHASE_1_SPIKE_RESULTS.md` §5 and §7

---

## 1. Decision

**Old WordPress URLs and `/wp-content/uploads/*` are handled in a custom Cloudflare Worker entry that runs before OpenNext. Next.js `proxy.ts` is not used for this.**

This changes one point of `05` §6.1 rule 7: the order "exact redirects → pattern rules → content routes → 404" now runs in the Worker entry instead of "middleware". The order itself is unchanged.

### Why

1. **Support status.** OpenNext builds Next 16's `proxy.ts` as Node.js middleware and warns on every build that this is *"experimental in cloudflare, and not officially maintained by OpenNext maintainers"*. A custom Worker entry is the documented, supported extension point (https://opennext.js.org/cloudflare/howtos/custom-worker).
2. **Cost and latency.** Images and redirects are answered without starting the Next.js server function. Every old image URL embedded in posts and on other sites hits this path.
3. **Testability.** The decision logic is a pure function (`resolveLegacyRequest`) with no Next or Workers dependency, so the whole audit can be replayed in unit tests.
4. **Evidence.** In phase 1 both approaches worked locally (`PHASE_1_SPIKE_RESULTS.md` §5); only the custom entry is officially supported.

### Consequences

- The layer does **not** run under `next dev`. It runs under `pnpm preview` and in production. Unit tests cover the logic; `pnpm check:legacy-preview` covers the wiring.
- `apps/web/wrangler.jsonc` `"main"` is now `worker.ts`, which imports the generated `.open-next/worker.js`. `opennextjs-cloudflare build` must run before `wrangler dev` or a deploy, which the `preview` script already does.
- The Next app must not define routes under `/wp-content/uploads/` (they would never be reached).
- `proxy.ts`, all phase-1 spike routes and the `ENABLE_SPIKES` flag were removed. The spike code remains in commit `3250241`.

### Alternatives considered

| Option | Why not |
|---|---|
| `proxy.ts` (Next 16 Node.js middleware) | experimental and unmaintained on OpenNext; re-bundles Next internals that change between versions |
| `next.config` `redirects()` | static, build-time only; cannot express "only verified WordPress IDs", 410s, or media resizing; every change needs a rebuild |
| Next route handlers for `/wp-content/uploads` | every image request starts the Next server function; phase-1 spike C used this and it worked, but it is slower and costlier |

---

## 2. Request flow

```
request ─► worker.ts ─► handleLegacyRequest()           (src/legacy/worker-layer.ts)
                         │
                         ├─ resolveLegacyRequest()        pure, src/legacy/resolve-request.ts
                         │    1. /wp-content/uploads/*  ─► media handler (src/legacy/media-handler.ts)
                         │    2. pending client decision ─► pass (never redirected, never 410)
                         │    3. client-approved exact 410 / redirect
                         │    4. pattern rules (§3.2)
                         │    5. verified or unknown   ─► pass
                         │
                         └─ pass ─► OpenNext handler (.open-next/worker.js) ─► Next.js routes / 404
```

Responses produced by the layer carry `X-Legacy-Rule` (redirects and 410s) or `X-Legacy-Media` (media), so they can be told apart from Next responses.

---

## 3. Redirect resolution

### 3.1 Data

`scripts/generate-legacy-data.mjs` writes `src/legacy/generated/legacy-url-data.ts` from:

- `docs/audit/inventory/url_map.csv`: 139 rows, each with a disposition;
- `docs/audit/inventory/posts.csv`: 34 posts, WordPress ID → frozen URL;
- `migration/snapshot-2026-10-27/rest/pages_index.json` (local, git-ignored): page IDs.

The generated file records the SHA-256 of every input. `pnpm check:legacy` fails if it is out of date.

Rules enforced by the generator (anything else stops it; nothing is guessed):

| `action` | `decision_status` | Produces |
|---|---|---|
| `same_path` | `verified` | pass-through; the path must equal `new_path` |
| `pending_decision` | `needs_client_approval` | **nothing**: no redirect, no 410. `recommended_target` is advice to the client and is never applied |
| `redirect_301` / `redirect_302` | `client_approved` | exact redirect to `new_path` with that status |
| `gone_410` | `client_approved` | 410 |

Current data: **69 verified, 70 pending, 0 approved redirects, 0 approved 410s.** WordPress ID maps: 34 posts (`?p=`) and 12 pages (`?page_id=`). Only IDs whose URL is a verified `same_path` row are mapped, so `/causes/` (343), `/coming-soon/` (319) and the demo event are excluded.

When validating the data (`buildLookups`), the layer rejects: redirect cycles, self-redirects, targets that are not site-relative (`//host`, `https:`, backslashes), redirects or 410s for verified URLs, redirects that end at a pending or removed URL, and ID maps to unverified URLs. Redirect chains are collapsed to their final target; a chain that contains a 302 stays 302.

**How client decisions will be recorded.** `url_map.csv` is audit evidence, stored byte for byte, and should not be edited. When the client answers D4, record the decisions in a separate decisions file (or in the importer's D1 `legacy_urls` table) and extend the generator to read it. The generator already accepts the vocabulary in the table above.

### 3.2 Pattern rules (from `05` §6.1)

| Request | Response | Condition |
|---|---|---|
| `/wp-login.php`, `/xmlrpc.php`, `/wp-admin[/…]`, `/wp-json[/…]` | 410, any method | always (design rule: no redirect into the new admin) |
| `/?p=<id>` | 301 to the frozen post URL; other query parameters kept | ID in the verified post map |
| `/?page_id=<id>` | 301 to the page URL; other query parameters kept | ID in the verified page map |
| `/?s=<q>` | 301 to `/search/?q=<q>` | only when there is no `p` or `page_id` |
| `/<post-slug>/feed/` | 301 to `/feed/` | verified post slug |
| `/category/<slug>/feed/` | 301 to `/feed/` | verified category archive |
| `/sitemap_index.xml`, `/<name>-sitemap[N].xml` | 301 to `/sitemap.xml` | |
| `/?attachment_id=<id>` | pass (no redirect) | no verified attachment-page mapping exists |
| anything else | pass to Next.js | unknown URLs are never guessed |

Redirects apply to GET and HEAD only; other methods pass through. 410s apply to every method. `Cache-Control: public, max-age=3600` on redirects (short, in case a decision is corrected), `public, max-age=86400` on 410s.

### 3.3 Encoding and loops

- Paths are matched on the **decoded** UTF-8 string. Lowercase hex (as WordPress emits), uppercase hex (as browsers and `new URL()` emit) and raw UTF-8 all match. **No Unicode normalisation** (`05` §6.1 rule 5): an NFD variant of a slug is a different, unknown URL.
- `Location` headers use WordPress's lowercase percent-encoding. All 34 `?p=` redirects are tested byte for byte against `posts.csv`.
- Malformed escapes (`%E0%B4`) pass through instead of throwing.
- Paths without the trailing slash are looked up in their slashed form, so an approved redirect is a single hop.
- A redirect whose target equals the requested URL is never emitted (`loop_prevented`), even if the data were inconsistent.

---

## 4. Legacy media

### 4.1 Resolution order (`src/legacy/media-handler.ts`)

1. **Exact R2 key** in `MEDIA` (`wp-content/uploads/<decoded path>`): originals, `-scaled` files, PDFs, and resized copies if the uploads ZIP provides them. Supports `If-None-Match` (304), `Range` (206) and `HEAD`.
2. **Allow-listed resized name only:** the first existing source, in this order:
   1. the attachment's main file (usually the `-scaled` copy, at most 2560 px);
   2. the unscaled original.

   Sources above 20 MB, Cloudflare's documented Images input limit, are skipped. The chosen source is resized through the `IMAGES` binding, and the result is stored in the Cache API (`caches.open("legacy-media")`), keyed by path with the query string ignored.
3. **Safe fallback:** if the Images binding fails or is missing, the real, unresized source is served with `Cache-Control: no-store` and `X-Legacy-Media: fallback-original`.
4. **404 otherwise.** A missing original is never assumed to exist, and nothing is fabricated.

Methods other than GET and HEAD get 405. Malformed upload paths (encoded `/` or `\`, empty segments, control characters, invalid escapes) get 404 without touching R2. URL parsing resolves `..` before the Worker sees the path, so traversal cannot leave the uploads prefix, and the key builder also rejects raw dot segments.

### 4.2 Image-size allow-list

Generated into `src/legacy/generated/legacy-media-data.ts` (303 attachments):

| Source | Allowed resized files |
|---|---:|
| WordPress size metadata in the frozen REST media list (`media_details.sizes`, excluding `full`; name, width and height must agree) | 4,571 |
| Resized files referenced by the frozen public HTML/CSS whose original is a known public file in `asset_inventory.csv` (these are files the media API does not list) | 21 |
| Referenced but not allowed: original unknown | 1 (`2020/10/event-14-370x270.jpg`, theme demo) |

Any other `-WxH` name gets 404, even if the original exists. The only transformation ever requested is:

```
{ width: W, height: H, fit: "cover" }  →  output { format: same as the file extension, quality: 85 }
```

`cover` at WordPress's exact output dimensions reproduces the URL's size. Pixels will not match WordPress's own files exactly (`PHASE_1_SPIKE_RESULTS.md` §7).

The 34 media items the REST API counts but does not list are not in the allow-list. Their resized URLs answer 404 until a DB dump, WXR or uploads ZIP supplies their metadata (C3).

### 4.3 Caching and headers

| Response | `Cache-Control` | Notes |
|---|---|---|
| exact object, resized image | `public, max-age=31536000, immutable` | legacy keys are never renamed or rewritten (`05` §5.1). If a legacy file must ever be replaced, purge its URL |
| resized image | same, also stored in the Cache API | a repeat request does not cause a second transformation |
| fallback original | `no-store` | |
| 404 | `public, max-age=300` | a newly imported file appears within 5 minutes |

Every media response has `X-Content-Type-Options: nosniff` and a `Content-Security-Policy` with `sandbox`, so an uploaded SVG or HTML file can never run as a page. `Content-Type` comes from the R2 object metadata, falling back to the file extension; it is never sniffed. Errors are plain `Not Found` and never contain keys or local paths.

---

## 5. Tests

| Command | What | Result (28 Oct 2026, Windows 11, Node 22.23.2) |
|---|---|---|
| `pnpm test` | `src/legacy/*.test.ts` via Node's built-in runner (native TypeScript stripping; no new dependency) | **81/81 pass**, 0 skipped |
| | `audit-urls.test.ts`: all 139 `url_map.csv` rows, the 69 verified, the 70 pending (GET/HEAD/POST, with query, without slash), the 34 posts byte for byte, `?page_id=` against the snapshot | 42/42 |
| | `resolve-request.test.ts`: approved 301/302/410 (synthetic fixtures), query preservation, Malayalam encodings, NFD non-match, pattern rules, unknown URLs, malformed paths, chain collapse, cycle and unsafe-target rejection, runtime loop guard | 22/22 |
| | `media.test.ts`: allow-list equals the REST metadata; every resized file the frozen pages reference is allowed unless its original is unknown; fake R2/Images/Cache: direct serve, stored copy preferred, `-scaled` first, unscaled fallback, 20 MB skip, missing files, rejected sizes, Images failure, HEAD/405, 304/206, malformed path | 17/17 |
| `pnpm check:legacy` | generated data matches the inputs | no change |
| `pnpm preview` + `pnpm check:legacy-preview` | real `workerd` with local bindings | **195/195**: 139/139 URLs (none redirected or 410; no `X-Legacy-Rule`), 34/34 `?p=` with exact bytes, 11/11 patterns, 6/6 media, 5/5 app (home reaches OpenNext; spike routes 404) |
| `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm build:cf` | | all pass; the build no longer lists a Proxy, and the "experimental Node.js middleware" warning is gone |

Expected counts come from the CSVs at test time. Snapshot-based tests skip themselves on a clone without the local snapshot.

**Not covered end to end:** the resize path in `workerd`. This worktree's local R2 holds no client media, and we do not place invented files under real legacy keys. The resize path is covered by unit tests with a fake binding and was exercised against the real local Images binding in phase-1 spike C.

---

## 6. Windows notes

- OpenNext still warns that it is *"not fully compatible with Windows"*. Builds pass with `nodeLinker: hoisted`.
- `tsconfig.json` now sets `allowJs: false`. `wrangler types` makes `cloudflare-env.d.ts` reference `./worker`, which imports the generated `.open-next` bundle; with `allowJs` on, `tsc` type-checked that bundle and took minutes. With it off, `tsc` takes about 11 s.
- Tests run with `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` because `apps/web/package.json` has no `"type": "module"`. Adding that field was avoided so the Next and ESLint config loading stays unchanged.
- Stopping `pnpm preview` from a tool can leave `workerd.exe` holding port 8787: `taskkill /PID <pid> /T /F`.

---

## 7. Integration notes for the website and the importer

- The website must provide `/search/` (reading `?q=`), `/feed/` and `/sitemap.xml`; the redirects point there. It must not add routes under `/wp-content/uploads/`.
- The importer stores per-attachment WordPress sizes in D1 (`media.legacy_sizes_json`, branch `phase-2/importer`). Once the uploads ZIP or dump arrives, the allow-list can be generated from D1 (covering the 34 hidden items), or read from D1 at runtime with caching.
- Redirect decisions can later come from the importer's `legacy_urls` table instead of a generated file. `buildLookups()` validation must still run on whatever the source is.

---

## 8. Production verification still required (blocked on C1: Cloudflare account)

1. The custom entry deployed through `opennextjs-cloudflare` on a real Worker (staging): a normal page, a redirect, a 410, an image.
2. The **Images binding** in production: output dimensions and quality for JPEG/PNG/WebP, `fit: cover` behaviour, error codes, and billing (each allow-listed size of each image is one unique transformation per month; 5,000 a month free).
3. **Cache API** on the real zone (it does not work on `workers.dev`); confirm a second request is a cache hit and no second transformation.
4. `Range`/`If-None-Match` handling with real R2 objects, including large PDFs.
5. Redirect `Location` bytes for Malayalam posts through Cloudflare's edge (no re-encoding).
6. A full replay of the old site's URL list (all 139 audited URLs plus every image URL referenced by the frozen pages) against staging: 0 unexpected 404/500.
7. CPU time per request on the chosen plan (the media path does no CPU-heavy work in the Worker itself; transformations run in the Images service).

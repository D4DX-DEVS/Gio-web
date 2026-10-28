// Runs every audited URL through resolveLegacyRequest() and checks it against the
// audit's own decisions (docs/audit/inventory/url_map.csv, posts.csv).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LEGACY_URL_DATA } from "./generated/legacy-url-data.ts";
import { buildLookups } from "./lookups.ts";
import { encodeLegacyPath } from "./paths.ts";
import { resolveLegacyRequest } from "./resolve-request.ts";
import { hasSnapshot, readInventory, readSnapshotJson } from "./testing/audit-data.ts";

const ORIGIN = "https://www.giokerala.org";
const urlMap = readInventory("url_map.csv");
const posts = readInventory("posts.csv");
const lookups = buildLookups(LEGACY_URL_DATA);
const resolve = (url: string, method = "GET") => resolveLegacyRequest({ method, url }, lookups);

const verifiedRows = urlMap.filter((r) => r.action === "same_path" && r.decision_status === "verified");
const pendingRows = urlMap.filter((r) => r.action === "pending_decision" && r.decision_status === "needs_client_approval");
const nonAscii = (s: string) => /[^\x00-\x7f]/.test(s);
/** WordPress-style URL for an audited (decoded) path: lowercase percent-encoding. */
const wpUrl = (decodedPath: string, query = "") => `${ORIGIN}${encodeLegacyPath(decodedPath)}${query}`;

describe("url_map.csv: every audited URL", () => {
  test("the audit totals match the source data", () => {
    // Recorded so a change in the audit file is noticed, not silently absorbed
    assert.equal(urlMap.length, 139);
    assert.equal(verifiedRows.length, 69);
    assert.equal(pendingRows.length, 70);
    assert.equal(verifiedRows.length + pendingRows.length, urlMap.length, "every row is either verified same_path or pending");
  });

  test("generated data reflects url_map.csv exactly", () => {
    assert.deepEqual(
      LEGACY_URL_DATA.rows.map((r) => [r.path, r.action, r.decision]),
      urlMap.map((r) => [r.old_path, r.action, r.decision_status]),
    );
    const approved = urlMap.filter((r) => r.decision_status === "client_approved");
    assert.equal(LEGACY_URL_DATA.redirects.length + LEGACY_URL_DATA.gone.length, approved.length);
  });

  test("all 139 rows resolve without error, and none is redirected or removed", () => {
    for (const r of urlMap) {
      for (const url of [r.old_url, wpUrl(r.old_path)]) {
        const res = resolve(url);
        assert.equal(res.kind, "pass", `${r.old_path}: ${JSON.stringify(res)}`);
      }
    }
  });

  test("all 69 verified same_path rows keep their path and reach the app", () => {
    for (const r of verifiedRows) {
      assert.equal(r.new_path, r.old_path);
      for (const url of [r.old_url, wpUrl(r.old_path), wpUrl(r.old_path).replace(/\/$/, "")]) {
        assert.deepEqual(resolve(url), { kind: "pass", reason: "verified_same_path" }, url);
      }
    }
  });

  test("all 70 pending rows produce no redirect and no 410, whatever the method or query", () => {
    for (const r of pendingRows) {
      for (const url of [r.old_url, wpUrl(r.old_path), wpUrl(r.old_path, "?utm_source=x"), wpUrl(r.old_path).replace(/\/$/, "")]) {
        for (const method of ["GET", "HEAD", "POST"]) {
          assert.deepEqual(resolve(url, method), { kind: "pass", reason: "pending_decision" }, `${method} ${url}`);
        }
      }
      // the CSV's recommended_target is advice to the client and must never be applied
      assert.ok(!LEGACY_URL_DATA.redirects.some((x) => x.from === r.old_path));
    }
  });
});

describe("posts.csv: all 34 post URLs, byte for byte", () => {
  const malayalam = posts.filter((p) => nonAscii(decodeURIComponent(new URL(p.url).pathname)));

  test("34 posts, of which the Malayalam-slug posts are covered individually", () => {
    assert.equal(posts.length, 34);
    // The audit has 17 Malayalam (non-ASCII) slugs and 17 ASCII slugs
    assert.equal(malayalam.length, posts.filter((p) => nonAscii(p.slug_decoded)).length);
    assert.ok(malayalam.length > 0);
  });

  for (const p of posts) {
    test(`post ${p.wp_id} ${p.slug_decoded}`, () => {
      const frozen = new URL(p.url);
      const decoded = decodeURIComponent(frozen.pathname);
      // 1. our encoder reproduces the frozen WordPress URL byte for byte
      assert.equal(encodeLegacyPath(decoded), frozen.pathname);
      assert.equal(decoded, `/${p.slug_decoded}/`);
      // 2. the frozen URL, its uppercase-hex form and its decoded form all reach the post unchanged
      const upper = frozen.pathname.replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
      for (const path of [frozen.pathname, upper, encodeURI(decoded)]) {
        assert.deepEqual(resolve(`${ORIGIN}${path}`), { kind: "pass", reason: "verified_same_path" }, path);
      }
      // 3. /?p=<id> redirects to exactly the frozen URL bytes
      const res = resolve(`${ORIGIN}/?p=${p.wp_id}`);
      assert.equal(res.kind, "redirect");
      if (res.kind === "redirect") {
        assert.equal(res.status, 301);
        assert.equal(res.location, p.url);
      }
      // 4. the post's feed redirects to the site feed
      const feed = resolve(`${p.url}feed/`);
      assert.equal(feed.kind === "redirect" && feed.location, `${ORIGIN}/feed/`);
    });
  }

  test("posts.csv agrees with the frozen REST snapshot (skipped without the local snapshot)", { skip: !hasSnapshot }, () => {
    const rest = readSnapshotJson<Array<{ id: number; link: string }>>("rest/posts.json");
    const byId = new Map(rest.map((x) => [String(x.id), x.link]));
    assert.equal(rest.length, posts.length);
    for (const p of posts) assert.equal(byId.get(p.wp_id), p.url, `post ${p.wp_id}`);
  });
});

describe("WordPress page IDs (?page_id=)", () => {
  test("every mapped page ID points at a verified URL; pending pages are not mapped", { skip: !hasSnapshot }, () => {
    const pages = readSnapshotJson<Array<{ id: number; link: string; status: string }>>("rest/pages_index.json");
    const verified = new Set(verifiedRows.map((r) => r.old_path));
    for (const page of pages) {
      const path = decodeURIComponent(new URL(page.link).pathname);
      const res = resolve(`${ORIGIN}/?page_id=${page.id}`);
      if (page.status === "publish" && verified.has(path)) {
        assert.equal(res.kind === "redirect" && res.location, wpUrl(path), `page ${page.id}`);
      } else {
        assert.equal(res.kind, "pass", `page ${page.id} (${path}) must not redirect`);
      }
    }
  });
});

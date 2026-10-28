// Rule tests for resolveLegacyRequest() and buildLookups().
// FIXTURE DATA BELOW IS SYNTHETIC: no client decision exists yet for any redirect or
// removal (url_map.csv has 0 approved rows). Paths under /fixture-* are invented for
// testing the rules and never ship in the generated data.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LEGACY_URL_DATA } from "./generated/legacy-url-data.ts";
import { buildLookups, LegacyDataError, type LegacyLookups } from "./lookups.ts";
import { uploadKeyFromPathname } from "./paths.ts";
import { resolveLegacyRequest } from "./resolve-request.ts";
import type { LegacyUrlData } from "./types.ts";

const ORIGIN = "https://www.giokerala.org";
const ML = "പരീക്ഷണം"; // synthetic Malayalam slug ("test")
const ML_LOWER = encodeURIComponent(ML).toLowerCase();

const fixture = (over: Partial<LegacyUrlData> = {}): LegacyUrlData => ({
  rows: [
    { path: "/", type: "page", action: "same_path", decision: "verified" },
    { path: "/fixture-kept/", type: "page", action: "same_path", decision: "verified" },
    { path: `/fixture-${ML}/`, type: "post", action: "same_path", decision: "verified" },
    { path: "/fixture-pending/", type: "theme-demo-cpt", action: "pending_decision", decision: "needs_client_approval" },
    { path: "/fixture-old/", type: "page", action: "redirect_301", decision: "client_approved" },
    { path: "/fixture-temp/", type: "page", action: "redirect_302", decision: "client_approved" },
    { path: "/fixture-removed/", type: "page", action: "gone_410", decision: "client_approved" },
  ],
  redirects: [
    { from: "/fixture-old/", to: "/fixture-kept/", status: 301 },
    { from: "/fixture-temp/", to: `/fixture-${ML}/`, status: 302 },
  ],
  gone: ["/fixture-removed/"],
  wpPostIds: { "101": `/fixture-${ML}/` },
  wpPageIds: { "7": "/fixture-kept/", "2": "/" },
  postSlugs: [`fixture-${ML}`],
  categorySlugs: ["gio-news"],
  ...over,
});

const run = (lookups: LegacyLookups, url: string, method = "GET") => resolveLegacyRequest({ method, url: `${ORIGIN}${url}` }, lookups);
const L = buildLookups(fixture());

describe("approved exact rules", () => {
  test("approved 301 redirect keeps the query string", () => {
    assert.deepEqual(run(L, "/fixture-old/?utm=a&x=1"), { kind: "redirect", status: 301, location: `${ORIGIN}/fixture-kept/?utm=a&x=1`, rule: "approved_redirect" });
  });
  test("approved redirect matches without trailing slash (single hop)", () => {
    const r = run(L, "/fixture-old");
    assert.equal(r.kind === "redirect" && r.location, `${ORIGIN}/fixture-kept/`);
  });
  test("302 only when the approved mapping says so; Malayalam target encoded like WordPress", () => {
    assert.deepEqual(run(L, "/fixture-temp/"), { kind: "redirect", status: 302, location: `${ORIGIN}/fixture-${ML_LOWER}/`, rule: "approved_redirect" });
  });
  test("approved 410 for every method", () => {
    for (const m of ["GET", "HEAD", "POST"]) assert.deepEqual(run(L, "/fixture-removed/", m), { kind: "gone", rule: "approved_410" });
  });
  test("redirects apply to GET and HEAD only", () => {
    assert.deepEqual(run(L, "/fixture-old/", "POST"), { kind: "pass", reason: "method_not_redirected" });
    assert.equal(run(L, "/fixture-old/", "HEAD").kind, "redirect");
  });
});

describe("pending and unknown URLs", () => {
  test("pending URL is never redirected or removed, even if it also matches a pattern", () => {
    const l = buildLookups(fixture({ rows: [...fixture().rows, { path: "/wp-admin/", type: "x", action: "pending_decision", decision: "needs_client_approval" }] }));
    assert.deepEqual(run(l, "/fixture-pending/"), { kind: "pass", reason: "pending_decision" });
    assert.deepEqual(run(l, "/wp-admin/"), { kind: "pass", reason: "pending_decision" });
  });
  test("unknown URLs pass through; no destination is guessed", () => {
    for (const u of ["/no-such-page/", "/fixture-kep/", `/${ML}/`, "/?p=999999", "/?page_id=1", "/?attachment_id=5", "/unknown-slug/feed/", "/category/unknown/feed/"]) {
      assert.equal(run(L, u).kind, "pass", u);
    }
  });
  test("malformed percent-encoding passes through instead of throwing", () => {
    assert.deepEqual(run(L, "/%E0%B4/"), { kind: "pass", reason: "malformed_path" });
  });
});

describe("encoded Malayalam slugs", () => {
  test("lowercase, uppercase and decoded forms all match the same audited path", () => {
    const upper = encodeURIComponent(ML);
    for (const u of [`/fixture-${ML_LOWER}/`, `/fixture-${upper}/`, `/fixture-${ML}/`]) {
      assert.deepEqual(run(L, u), { kind: "pass", reason: "verified_same_path" }, u);
    }
  });
  test("no Unicode normalisation: a differently encoded but canonically-equal slug does not match", () => {
    // NFD of a precomposed vowel sign (U+0D4A) is U+0D46 U+0D3E
    const l = buildLookups(fixture({ rows: [{ path: "/പൊ/", type: "post", action: "same_path", decision: "verified" }] , redirects: [], gone: [], wpPostIds: {}, wpPageIds: {}, postSlugs: [] }));
    assert.deepEqual(run(l, "/പൊ/"), { kind: "pass", reason: "verified_same_path" });
    assert.deepEqual(run(l, "/പൊ/"), { kind: "pass", reason: "unknown" });
  });
});

describe("pattern rules from 05-MIGRATION-DESIGN.md §6.1", () => {
  test("WordPress endpoints answer 410 for any method", () => {
    for (const u of ["/wp-login.php", "/xmlrpc.php", "/wp-admin", "/wp-admin/", "/wp-admin/post.php?post=1", "/wp-json/", "/wp-json/wp/v2/users"]) {
      for (const m of ["GET", "POST"]) assert.deepEqual(run(L, u, m), { kind: "gone", rule: "wordpress_endpoint" }, `${m} ${u}`);
    }
    assert.equal(run(L, "/wp-adminx/").kind, "pass");
  });
  test("?p=<id> only for verified IDs; other query parameters kept", () => {
    assert.deepEqual(run(L, "/?p=101&utm=x"), { kind: "redirect", status: 301, location: `${ORIGIN}/fixture-${ML_LOWER}/?utm=x`, rule: "wp_post_id" });
    assert.equal(run(L, "/?p=abc").kind, "pass");
    assert.equal(run(L, "/fixture-kept/?p=101").kind, "pass", "only the site root carries WordPress query URLs");
  });
  test("?page_id=<id>, including the home page", () => {
    assert.equal((run(L, "/?page_id=7") as { location: string }).location, `${ORIGIN}/fixture-kept/`);
    assert.equal((run(L, "/?page_id=2") as { location: string }).location, `${ORIGIN}/`);
  });
  test("?s= search goes to /search/?q=", () => {
    assert.equal((run(L, "/?s=%E0%B4%95%E0%B5%87%E0%B4%B0%E0%B4%B3%E0%B4%82") as { location: string }).location, `${ORIGIN}/search/?q=%E0%B4%95%E0%B5%87%E0%B4%B0%E0%B4%B3%E0%B4%82`);
    assert.equal(run(L, "/?p=999999&s=x").kind, "pass", "an unknown ?p= is not turned into a search");
  });
  test("feeds of verified posts and categories go to /feed/; /feed/ itself is served", () => {
    assert.equal((run(L, `/fixture-${ML_LOWER}/feed/`) as { location: string }).location, `${ORIGIN}/feed/`);
    assert.equal((run(L, "/category/gio-news/feed/") as { location: string }).location, `${ORIGIN}/feed/`);
    assert.equal(run(L, "/feed/").kind, "pass");
  });
  test("WordPress sitemaps go to /sitemap.xml; /sitemap.xml itself is served", () => {
    for (const u of ["/sitemap_index.xml", "/post-sitemap.xml", "/page-sitemap2.xml", "/tribe_events-sitemap.xml"]) {
      assert.equal((run(L, u) as { location: string }).location, `${ORIGIN}/sitemap.xml`, u);
    }
    assert.equal(run(L, "/sitemap.xml").kind, "pass");
  });
  test("uploads are handed to the media handler; traversal is rejected", () => {
    assert.deepEqual(run(L, "/wp-content/uploads/2025/08/bnr1.jpg"), { kind: "media", key: "wp-content/uploads/2025/08/bnr1.jpg" });
    assert.deepEqual(run(L, `/wp-content/uploads/2025/08/${ML_LOWER}.jpg`), { kind: "media", key: `wp-content/uploads/2025/08/${ML}.jpg` });
    for (const u of ["/wp-content/uploads/a%2Fb.jpg", "/wp-content/uploads/a%5Cb.jpg", "/wp-content/uploads/2025//x.jpg", "/wp-content/uploads/2025/", "/wp-content/uploads/%E0.jpg", "/wp-content/uploads/%00.jpg"]) {
      assert.deepEqual(run(L, u), { kind: "media", key: null }, u);
    }
    // URL parsing resolves dot segments first, so ".." can never leave the uploads prefix
    assert.deepEqual(run(L, "/wp-content/uploads/2025/%2e%2e/x.jpg"), { kind: "media", key: "wp-content/uploads/x.jpg" });
    assert.equal(run(L, "/wp-content/uploads/../../secret.txt").kind, "pass");
    // and the key builder itself rejects raw dot segments
    assert.equal(uploadKeyFromPathname("/wp-content/uploads/2025/../x.jpg"), null);
    assert.equal(uploadKeyFromPathname("/wp-content/uploads/2025/%2E%2E/x.jpg"), null);
  });
});

describe("redirect-loop prevention", () => {
  test("chains are collapsed to the final target", () => {
    const l = buildLookups(fixture({ redirects: [{ from: "/a/", to: "/b/", status: 301 }, { from: "/b/", to: "/fixture-kept/", status: 301 }] }));
    assert.equal((run(l, "/a/") as { location: string }).location, `${ORIGIN}/fixture-kept/`);
  });
  test("a temporary hop keeps the chain temporary", () => {
    const l = buildLookups(fixture({ redirects: [{ from: "/a/", to: "/b/", status: 301 }, { from: "/b/", to: "/fixture-kept/", status: 302 }] }));
    assert.equal((run(l, "/a/") as { status: number }).status, 302);
  });
  test("cycles, self-redirects and unsafe targets are rejected when the data is loaded", () => {
    const bad: Array<Partial<LegacyUrlData>> = [
      { redirects: [{ from: "/a/", to: "/b/", status: 301 }, { from: "/b/", to: "/a/", status: 301 }] },
      { redirects: [{ from: "/a/", to: "/a/", status: 301 }] },
      { redirects: [{ from: "/a/", to: "//evil.example/", status: 301 }] },
      { redirects: [{ from: "/a/", to: "https://evil.example/", status: 301 }] },
      { redirects: [{ from: "/a/", to: "/fixture-pending/", status: 301 }] },
      { redirects: [{ from: "/a/", to: "/fixture-removed/", status: 301 }] },
      { redirects: [{ from: "/fixture-kept/", to: "/x/", status: 301 }] },
      { gone: ["/fixture-kept/"] },
      { wpPostIds: { "5": "/fixture-pending/" } },
    ];
    for (const over of bad) assert.throws(() => buildLookups(fixture(over)), LegacyDataError, JSON.stringify(over));
  });
  test("a redirect to the requested URL is never emitted, even with inconsistent data", () => {
    const l = buildLookups(fixture());
    l.redirects.set("/fixture-loop/", { to: "/fixture-loop/", status: 301 });
    assert.deepEqual(run(l, "/fixture-loop/"), { kind: "pass", reason: "loop_prevented" });
  });
});

test("the generated production data loads and passes validation", () => {
  const l = buildLookups(LEGACY_URL_DATA);
  assert.equal(l.dispositions.size, LEGACY_URL_DATA.rows.length);
});

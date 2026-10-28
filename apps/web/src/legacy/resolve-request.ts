// resolveLegacyRequest(): decides what to do with a request for a legacy
// WordPress URL before it reaches Next.js. Pure: no I/O, no bindings.
//
// Order (05-MIGRATION-DESIGN.md §6.1 rule 7, adapted to the Worker entry):
//   1. /wp-content/uploads/*            → media handler
//   2. URLs pending a client decision   → pass through untouched (never redirected or removed)
//   3. client-approved exact 410s and redirects
//   4. pattern rules from 05 §6.1        (410 for WordPress endpoints, ?p= / ?page_id= / ?s=,
//                                         post and category feeds, WordPress sitemaps)
//   5. everything else                  → pass through to Next.js (content routes, then 404)
// Unknown URLs are never guessed: they pass through.
import type { LegacyLookups } from "./lookups.ts";
import { encodeLegacyPath, safeDecode, uploadKeyFromPathname, UPLOADS_PREFIX } from "./paths.ts";
import type { LegacyResolution } from "./types.ts";

const REDIRECTABLE = new Set(["GET", "HEAD"]);
const GONE_EXACT = new Set(["/wp-login.php", "/xmlrpc.php"]);
const GONE_PREFIXES = ["/wp-json", "/wp-admin"];
const WP_SITEMAP = /^\/(?:sitemap_index|[a-z0-9_-]+-sitemap\d*)\.xml$/;

export interface LegacyRequest {
  method: string;
  url: string | URL;
}

export function resolveLegacyRequest(request: LegacyRequest, lookups: LegacyLookups): LegacyResolution {
  const url = typeof request.url === "string" ? new URL(request.url) : request.url;
  const method = request.method.toUpperCase();

  if (url.pathname.startsWith(UPLOADS_PREFIX)) {
    return { kind: "media", key: uploadKeyFromPathname(url.pathname) };
  }

  const path = safeDecode(url.pathname);
  if (path === null) return { kind: "pass", reason: "malformed_path" };
  // Paths are audited with a trailing slash; Next adds it later, so also look up the slashed form.
  const candidates = path.endsWith("/") ? [path] : [path, `${path}/`];

  const row = candidates.map((p) => lookups.dispositions.get(p)).find(Boolean);
  if (row?.action === "pending_decision") return { kind: "pass", reason: "pending_decision" };

  for (const p of candidates) {
    if (lookups.gone.has(p)) return { kind: "gone", rule: "approved_410" };
  }
  for (const p of candidates) {
    const r = lookups.redirects.get(p);
    if (r) return redirect(url, method, r.to, url.search, r.status, "approved_redirect");
  }

  if (GONE_EXACT.has(path) || GONE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return { kind: "gone", rule: "wordpress_endpoint" };
  }

  if (path === "/" && url.search) {
    const params = url.searchParams;
    const p = params.get("p");
    const pageId = params.get("page_id");
    if (p !== null && /^\d+$/.test(p) && lookups.wpPostIds.has(p)) {
      return redirect(url, method, lookups.wpPostIds.get(p)!, remainingQuery(params, ["p"]), 301, "wp_post_id");
    }
    if (pageId !== null && /^\d+$/.test(pageId) && lookups.wpPageIds.has(pageId)) {
      return redirect(url, method, lookups.wpPageIds.get(pageId)!, remainingQuery(params, ["page_id"]), 301, "wp_page_id");
    }
    const s = params.get("s");
    if (s !== null && p === null && pageId === null) {
      return redirect(url, method, "/search/", `?${new URLSearchParams({ q: s })}`, 301, "wp_search");
    }
  }

  const feed = /^\/(?:category\/)?([^/]+)\/feed\/?$/.exec(path);
  if (feed) {
    const isCategory = path.startsWith("/category/");
    const known = isCategory ? lookups.categorySlugs.has(feed[1]) : lookups.postSlugs.has(feed[1]);
    if (known) return redirect(url, method, "/feed/", "", 301, isCategory ? "category_feed" : "post_feed");
  }

  if (WP_SITEMAP.test(path)) return redirect(url, method, "/sitemap.xml", "", 301, "wp_sitemap");

  if (row?.action === "same_path") return { kind: "pass", reason: "verified_same_path" };
  return { kind: "pass", reason: "unknown" };
}

function remainingQuery(params: URLSearchParams, drop: string[]): string {
  const rest = new URLSearchParams([...params].filter(([k]) => !drop.includes(k)));
  const q = rest.toString();
  return q ? `?${q}` : "";
}

function redirect(url: URL, method: string, targetPath: string, query: string, status: 301 | 302, rule: string): LegacyResolution {
  if (!REDIRECTABLE.has(method)) return { kind: "pass", reason: "method_not_redirected" };
  const encodedTarget = encodeLegacyPath(targetPath);
  // Never answer with a redirect to the URL that was requested
  const current = (safeDecode(url.pathname) ?? url.pathname) + url.search;
  if (targetPath + query === current || encodedTarget + query === url.pathname + url.search) {
    return { kind: "pass", reason: "loop_prevented" };
  }
  return { kind: "redirect", status, location: `${url.origin}${encodedTarget}${query}`, rule };
}

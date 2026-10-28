// End-to-end check of the custom Worker entry against a running `pnpm preview`
// (workerd, local bindings). Expectations are derived from the audit CSVs.
// Usage (from apps/web): node scripts/check-legacy-preview.mjs [http://localhost:8787]
//
// Local R2 holds no client media in this worktree, so real legacy keys are expected
// to answer 404 (nothing is assumed to exist). Direct serving is exercised with the
// synthetic phase-1 objects under wp-content/uploads/2099/01/, if present.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:8787").replace(/\/$/, "");
const inventory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/audit/inventory");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [h, ...b] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const urlMap = parseCsv(readFileSync(path.join(inventory, "url_map.csv"), "utf8"));
const posts = parseCsv(readFileSync(path.join(inventory, "posts.csv"), "utf8"));

const results = [];
const check = (group, name, pass, detail = "") => {
  results.push({ group, pass });
  if (!pass || process.env.VERBOSE) console.log(`${pass ? "PASS" : "FAIL"}  [${group}] ${name}${detail ? `  -- ${detail}` : ""}`);
};
const req = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });
const local = (u) => new URL(u).pathname + new URL(u).search;

// 1. All 139 audited URLs: no redirect, no 410, nothing from the legacy layer
for (const r of urlMap) {
  const res = await req(local(r.old_url));
  const legacy = res.headers.get("x-legacy-rule");
  check("urls", `${r.action} ${r.old_path}`, ![301, 302, 307, 308, 410].includes(res.status) && !legacy, `${res.status} ${legacy ?? ""}`);
  await res.body?.cancel();
}

// 2. All 34 posts: /?p=<id> answers 301 with the frozen URL bytes
for (const p of posts) {
  const res = await req(`/?p=${p.wp_id}`);
  const loc = res.headers.get("location") ?? "";
  check("posts", `?p=${p.wp_id}`, res.status === 301 && loc.slice(loc.indexOf("/", 8)) === new URL(p.url).pathname, `${res.status} ${loc}`);
}

// 3. Pattern rules
const patterns = [
  ["/wp-login.php", 410, null], ["/wp-admin/", 410, null], ["/wp-json/wp/v2/users", 410, null], ["/xmlrpc.php", 410, null],
  ["/sitemap_index.xml", 301, "/sitemap.xml"], ["/post-sitemap.xml", 301, "/sitemap.xml"],
  ["/?s=gio", 301, "/search/?q=gio"], ["/category/gio-news/feed/", 301, "/feed/"],
  ["/?p=999999", 200, null], ["/no-such-page/", 404, null],
];
for (const [p, status, target] of patterns) {
  const res = await req(p);
  const loc = res.headers.get("location");
  check("patterns", p, res.status === status && (target === null || (loc && local(loc) === target)), `${res.status} ${loc ?? ""}`);
  await res.body?.cancel();
}
const post = await req("/wp-login.php", { method: "POST", body: "log=x" });
check("patterns", "POST /wp-login.php → 410", post.status === 410, String(post.status));

// 4. Media
const media = [
  ["synthetic object served directly", "/wp-content/uploads/2099/01/spike-test.png", 200, "public, max-age=31536000, immutable"],
  ["size not allow-listed → 404", "/wp-content/uploads/2099/01/spike-test-300x200.png", 404, "public, max-age=300"],
  ["real allow-listed size, original absent from local R2 → 404", "/wp-content/uploads/2024/07/IMG_1977-150x150.jpg", 404, "public, max-age=300"],
  ["real original absent from local R2 → 404", "/wp-content/uploads/2025/08/bnr1.jpg", 404, "public, max-age=300"],
  ["malformed path → 404", "/wp-content/uploads/a%2Fb.jpg", 404, "public, max-age=300"],
];
for (const [name, p, status, cache] of media) {
  const res = await req(p);
  const body = await res.text();
  check("media", name, res.status === status && res.headers.get("cache-control") === cache && res.headers.get("x-content-type-options") === "nosniff" && !/[A-Z]:\\|snapshot/.test(body), `${res.status} ${res.headers.get("cache-control")} ${res.headers.get("content-type")}`);
}
const mpost = await req("/wp-content/uploads/2099/01/spike-test.png", { method: "POST" });
check("media", "POST → 405", mpost.status === 405, String(mpost.status));

// 5. Ordinary routes still reach OpenNext; spike routes are gone
const home = await req("/");
check("app", "home page via OpenNext", home.status === 200 && (await home.text()).includes("<html"), String(home.status));
for (const p of ["/spike/search/", "/spike/whoami/", "/api/spike-auth/ok", "/spike-legacy/old-path/"]) {
  const res = await req(p);
  check("app", `spike route removed: ${p}`, res.status === 404, String(res.status));
  await res.body?.cancel();
}

const groups = [...new Set(results.map((r) => r.group))];
for (const g of groups) {
  const rs = results.filter((r) => r.group === g);
  console.log(`${g}: ${rs.filter((r) => r.pass).length}/${rs.length}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`${BASE}: ${results.length - failed}/${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;

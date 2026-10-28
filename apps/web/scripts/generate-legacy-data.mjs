// Generates the data the legacy URL and media layer runs on:
//   src/legacy/generated/legacy-url-data.ts    (from docs/audit/inventory/url_map.csv, posts.csv
//                                               and the frozen REST pages index)
//   src/legacy/generated/legacy-media-data.ts  (from the frozen REST media list, the frozen
//                                               HTML/CSS/REST references and asset_inventory.csv)
//
// Usage (from apps/web): node scripts/generate-legacy-data.mjs [--check]
//   --check  exit 1 if the generated files would change (no files written)
//
// Inputs are read only. The frozen snapshot (migration/snapshot-2026-10-27) is local and
// git-ignored; only derived public facts (paths, WordPress IDs, image file names) are
// written out. Nothing here contacts the live site.
//
// Decision rules (docs/audit/05-MIGRATION-DESIGN.md §6, 04-STATUS-AND-DECISIONS.md §4-5):
//   - url_map rows with decision_status "verified" and action "same_path" keep their path.
//   - rows with decision_status "needs_client_approval" produce nothing (no redirect, no 410).
//   - only rows with decision_status "client_approved" may produce a redirect or a 410, and
//     only with an explicit action: redirect_301 | redirect_302 | gone_410.
//   - anything else stops the generator; nothing is guessed.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const inventory = path.join(repo, "docs/audit/inventory");
const snapshot = path.join(repo, "migration/snapshot-2026-10-27");
const outDir = path.resolve(here, "../src/legacy/generated");
const check = process.argv.includes("--check");

const ORIGIN = "https://www.giokerala.org";
const UPLOADS = "/wp-content/uploads/";
const RESIZED = /^(.+)-(\d+)x(\d+)\.(jpe?g|png|gif|webp)$/i;

function fail(message) {
  console.error(`generate-legacy-data: ${message}`);
  process.exit(1);
}

// Minimal RFC 4180 parser (quoted fields, embedded commas/quotes/newlines, UTF-8 BOM).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function readInput(file) {
  if (!existsSync(file)) fail(`missing input ${path.relative(repo, file)}`);
  const buf = readFileSync(file);
  sources[path.relative(repo, file).replaceAll("\\", "/")] = createHash("sha256").update(buf).digest("hex");
  return buf.toString("utf8");
}

const sources = {};
const decodePath = (p) => decodeURIComponent(p);
// WordPress emits lowercase percent-encoding for non-ASCII slugs.
const encodeLegacyPath = (p) =>
  p.split("/").map((s) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())).join("/");

// ---------------------------------------------------------------- URL data
const urlMap = parseCsv(readInput(path.join(inventory, "url_map.csv")));
const posts = parseCsv(readInput(path.join(inventory, "posts.csv")));
if (!existsSync(snapshot)) fail("frozen snapshot not found at migration/snapshot-2026-10-27 (local only); generated files left unchanged");
const pagesIndex = JSON.parse(readInput(path.join(snapshot, "rest/pages_index.json")));

const rows = [];
const redirects = [];
const gone = [];
const seen = new Set();
for (const r of urlMap) {
  const url = new URL(r.old_url);
  if (url.origin !== ORIGIN) fail(`unexpected origin in url_map: ${r.old_url}`);
  const p = decodePath(url.pathname);
  if (p !== r.old_path) fail(`old_path does not match old_url: ${r.old_url}`);
  if (seen.has(p)) fail(`duplicate path in url_map: ${p}`);
  seen.add(p);
  const key = `${r.action}|${r.decision_status}`;
  switch (key) {
    case "same_path|verified":
      if (r.new_path !== r.old_path) fail(`same_path row with different new_path: ${p}`);
      break;
    case "pending_decision|needs_client_approval":
      break; // recommended_target is advice to the client, never applied
    case "redirect_301|client_approved":
    case "redirect_302|client_approved":
      if (!r.new_path) fail(`approved redirect without new_path: ${p}`);
      redirects.push({ from: p, to: r.new_path, status: r.action === "redirect_301" ? 301 : 302 });
      break;
    case "gone_410|client_approved":
      gone.push(p);
      break;
    default:
      fail(`unsupported action/decision "${key}" for ${p}; add an explicit rule before generating`);
  }
  rows.push({ path: p, type: r.type, action: r.action, decision: r.decision_status });
}

const verified = new Set(rows.filter((r) => r.action === "same_path").map((r) => r.path));

const wpPostIds = {};
const postSlugs = [];
for (const p of posts) {
  const url = new URL(p.url);
  const decoded = decodePath(url.pathname);
  if (!verified.has(decoded)) fail(`post ${p.wp_id} is not a verified same_path row: ${decoded}`);
  if (encodeLegacyPath(decoded) !== url.pathname) fail(`post ${p.wp_id} URL is not in WordPress lowercase encoding`);
  if (p.status !== "publish") continue;
  wpPostIds[p.wp_id] = decoded;
  postSlugs.push(decoded.replace(/^\/|\/$/g, ""));
}

const wpPageIds = {};
for (const p of pagesIndex) {
  const decoded = decodePath(new URL(p.link).pathname);
  // Only published pages whose URL is a verified same_path row (pending pages produce nothing)
  if (p.status === "publish" && verified.has(decoded)) wpPageIds[String(p.id)] = decoded;
}

const categorySlugs = rows
  .filter((r) => r.type === "taxonomy-archive" && r.action === "same_path")
  .map((r) => /^\/category\/([^/]+)\/$/.exec(r.path)?.[1])
  .filter(Boolean);

// ---------------------------------------------------------------- media data
const media = JSON.parse(readInput(path.join(snapshot, "rest/media.json")));
const assets = parseCsv(readInput(path.join(inventory, "asset_inventory.csv")));
const assetPaths = new Set(
  assets.map((a) => new URL(a.file_url)).filter((u) => u.origin === ORIGIN && u.pathname.startsWith(UPLOADS)).map((u) => decodePath(u.pathname.slice(UPLOADS.length))),
);

const dirOf = (p) => (p.includes("/") ? path.posix.dirname(p) : "");
const join = (dir, file) => (dir ? `${dir}/${file}` : file);
const relUpload = (url) => {
  const u = new URL(url);
  if (u.origin !== ORIGIN || !u.pathname.startsWith(UPLOADS)) return null;
  return decodePath(u.pathname.slice(UPLOADS.length));
};

/** dir → { sources: string[], sizes: Set<string>, origin } */
const attachments = new Map();
const sizeOwner = new Map();
const addSize = (dir, att, file) => {
  const k = join(dir, file);
  const owner = sizeOwner.get(k);
  if (owner && owner !== att) fail(`resized file claimed by two attachments: ${k}`);
  sizeOwner.set(k, att);
  att.sizes.add(file);
};

let fromMetadata = 0;
for (const m of media) {
  const main = relUpload(m.source_url);
  if (!main) fail(`media ${m.id} has an unexpected source_url`);
  const sizes = Object.entries(m.media_details?.sizes ?? {});
  if (!sizes.length) continue; // PDFs and other files have no resized copies
  const dir = dirOf(main);
  const mainFile = path.posix.basename(main);
  const att = { dir, sources: [mainFile], sizes: new Set(), evidence: "wp_metadata" };
  const original = m.media_details?.original_image;
  if (original && original !== mainFile) att.sources.push(original);
  for (const [, s] of sizes) {
    if (s.file === mainFile) continue;
    const mm = RESIZED.exec(s.file);
    if (!mm || Number(mm[2]) !== s.width || Number(mm[3]) !== s.height) continue; // not a WxH copy
    addSize(dir, att, s.file);
    fromMetadata++;
  }
  attachments.set(join(dir, mainFile), att);
}

// Resized copies referenced by the frozen public pages but absent from the media metadata
// (files the media API does not list). Allowed only if the unresized original is itself a
// known public file in asset_inventory.csv.
const refPattern = /wp-content\/uploads\/([^"'\s)?#<>\\]+?-\d+x\d+\.(?:jpe?g|png|gif|webp))/gi;
const scanFiles = [
  ...readdirSync(path.join(snapshot, "html")).map((f) => path.join(snapshot, "html", f)),
  ...readdirSync(path.join(snapshot, "css")).filter((f) => f.endsWith(".css")).map((f) => path.join(snapshot, "css", f)),
];
const referenced = new Set();
for (const f of scanFiles) {
  for (const m of readFileSync(f, "utf8").matchAll(refPattern)) {
    try { referenced.add(decodePath(m[1])); } catch { /* malformed escape in page source: ignore */ }
  }
}
let fromHtml = 0;
const unresolvedRefs = [];
for (const ref of [...referenced].sort()) {
  if (sizeOwner.has(ref)) continue;
  const mm = RESIZED.exec(ref);
  const original = `${mm[1]}.${mm[4]}`;
  if (!assetPaths.has(original)) { unresolvedRefs.push(ref); continue; }
  const dir = dirOf(original);
  const key = original;
  let att = attachments.get(key);
  if (!att) { att = { dir, sources: [path.posix.basename(original)], sizes: new Set(), evidence: "html_reference" }; attachments.set(key, att); }
  addSize(dir, att, path.posix.basename(ref));
  fromHtml++;
}

// ---------------------------------------------------------------- write
const header = (what) =>
  `// GENERATED by apps/web/scripts/generate-legacy-data.mjs. Do not edit by hand.\n` +
  `// ${what}\n// Inputs (sha256):\n` +
  Object.entries(sources).map(([f, h]) => `//   ${f} ${h}`).join("\n") + "\n\n";

const urlData = {
  rows,
  redirects,
  gone,
  wpPostIds,
  wpPageIds,
  postSlugs: postSlugs.sort(),
  categorySlugs: categorySlugs.sort(),
};
const mediaData = {
  attachments: [...attachments.values()]
    .filter((a) => a.sizes.size)
    .sort((a, b) => join(a.dir, a.sources[0]).localeCompare(join(b.dir, b.sources[0])))
    .map((a) => ({ dir: a.dir, sources: a.sources, sizes: [...a.sizes].sort(), evidence: a.evidence })),
};

const files = {
  "legacy-url-data.ts":
    header("Legacy URL dispositions, approved redirects/410s and verified WordPress ID maps.") +
    `import type { LegacyUrlData } from "../types.ts";\n\nexport const LEGACY_URL_DATA: LegacyUrlData = ${JSON.stringify(urlData, null, 2)};\n`,
  "legacy-media-data.ts":
    header("Allow-list of legacy resized-image files per attachment (paths relative to wp-content/uploads).") +
    `import type { LegacyMediaData } from "../types.ts";\n\nexport const LEGACY_MEDIA_DATA: LegacyMediaData = ${JSON.stringify(mediaData)};\n`,
};

let changed = false;
for (const [name, content] of Object.entries(files)) {
  const target = path.join(outDir, name);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current !== content) {
    changed = true;
    if (!check) writeFileSync(target, content);
  }
}

console.log(
  JSON.stringify(
    {
      urlRows: rows.length,
      verifiedSamePath: verified.size,
      pending: rows.filter((r) => r.action === "pending_decision").length,
      approvedRedirects: redirects.length,
      approvedGone: gone.length,
      wpPostIds: Object.keys(wpPostIds).length,
      wpPageIds: Object.keys(wpPageIds).length,
      categorySlugs: categorySlugs.length,
      mediaAttachments: mediaData.attachments.length,
      allowedSizesFromWpMetadata: fromMetadata,
      allowedSizesFromHtmlReferences: fromHtml,
      unresolvedResizedReferences: unresolvedRefs,
      changed,
    },
    null,
    2,
  ),
);
if (check && changed) process.exit(1);

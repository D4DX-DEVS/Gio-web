// `build`: extract + normalise + merge + transform (05 §3) from the sources present, into one
// validated staging bundle. Pure and offline: reads only the frozen snapshot and the URL map.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MediaIndex } from "./media-index";
import { Bundle, type BundleParts, emptyParts } from "./model";
import { buildReviewItems } from "./review";
import { readHtml, setHtmlRedactions } from "./sources/html";
import { readRest } from "./sources/rest";
import { linkLegacyUrls, readUrlMap } from "./sources/urlmap";
import { Snapshot } from "./snapshot";
import { type Redactions, containsSecret, stableStringify } from "./lib/util";

export interface BuildOptions {
  snapshotDir: string;
  urlMapCsv: string;
}

export function buildBundle(opts: BuildOptions): Bundle {
  const snap = new Snapshot(opts.snapshotDir);
  const parts = emptyParts();
  const redactions: Redactions = { count: 0 };
  setHtmlRedactions(redactions);
  const media = new MediaIndex(snap);

  readUrlMap(opts.urlMapCsv, parts);
  readRest(snap, media, parts, redactions);
  readHtml(snap, media, parts, redactions);
  linkLegacyUrls(parts);

  parts.media = media.all();
  dedupeUsage(parts);
  buildDocuments(parts);
  buildReviewItems(parts);
  markPendingFromReview(parts);

  const bundle = Bundle.parse({
    meta: {
      bundleVersion: 1,
      sourceLabel: snap.label,
      sourceKinds: ["rest_snapshot", "html_snapshot", "url_map"],
      snapshotSha256: snap.fingerprint(),
      builtAt: new Date().toISOString(),
      secretsRedacted: redactions.count,
    },
    ...parts,
  });

  const text = stableStringify(bundle);
  if (containsSecret(text)) throw new Error("Refusing to write a bundle that contains an API key");
  return bundle;
}

export function writeBundle(bundle: Bundle, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, "bundle.json");
  writeFileSync(file, JSON.stringify(bundle, null, 1));
  return file;
}

function dedupeUsage(parts: BundleParts) {
  const seen = new Set<string>();
  parts.mediaUsage = parts.mediaUsage.filter((u) => {
    const k = `${u.media}|${u.entityKey}|${u.field}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** PDFs become documents. Linked from a published page = published; otherwise draft until C6. */
function buildDocuments(parts: BundleParts) {
  const used = new Set(parts.mediaUsage.map((u) => u.media));
  let sort = 0;
  for (const m of parts.media.filter((m) => m.kind === "document" && !m.variantOf)) {
    const linked = used.has(m.key);
    m.usageHint ??= "document";
    parts.documents.push({
      key: `document:${m.path}`,
      source: m.source,
      sourceRef: m.sourceRef,
      reviewState: linked ? "verified" : "pending_client",
      media: m.key,
      title: m.title ?? m.originalFilename,
      description: null,
      category: /call-for-paper/i.test(m.path) ? "call_for_papers" : /brouchure|brochure/i.test(m.path) ? "brochure" : null,
      status: linked ? "published" : "draft",
      publishedAtMs: linked ? m.createdAtMs : null,
      sort: ++sort,
    });
  }
}

function markPendingFromReview(parts: BundleParts) {
  const flagged = new Set(
    parts.reviewItems.filter((r) => ["Q1", "Q2", "Q3", "Q4", "Q12"].includes(r.code) && r.entityKey).map((r) => r.entityKey!),
  );
  for (const list of [parts.posts, parts.leaders] as { key: string; reviewState: string }[][]) {
    for (const r of list) if (flagged.has(r.key)) r.reviewState = "pending_client";
  }
}

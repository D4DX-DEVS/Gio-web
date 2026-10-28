// Every audited URL becomes a legacy_urls row (05 §6.1 step 2), from docs/audit/inventory/url_map.csv.
// Pending rows keep their recommended target as advice only; no redirect is created for them.
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type { BundleParts, LegacyUrlRec } from "../model";
import { percentDecode, wpEncodePath } from "../lib/util";

interface UrlMapRow {
  old_url: string;
  old_path: string;
  type: string;
  live_status: string;
  in_sitemap: string;
  new_path: string;
  action: string;
  recommended_target: string;
  decision_status: string;
  note: string;
}

export function readUrlMap(csvPath: string, parts: BundleParts): void {
  const rows = parse(readFileSync(csvPath), { columns: true, bom: true, skip_empty_lines: true }) as UrlMapRow[];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.old_path)) {
      parts.warnings.push(`url_map: duplicate old_path ${r.old_path}`);
      continue;
    }
    seen.add(r.old_path);
    // url_map.csv stores paths decoded; legacy_urls.old_path is the form WordPress emits.
    const decoded = percentDecode(r.old_path);
    parts.legacyUrls.push({
      oldPath: wpEncodePath(decoded),
      oldPathDecoded: decoded,
      legacyType: r.type,
      liveStatus: r.live_status ? Number(r.live_status) || null : null,
      inSitemap: r.in_sitemap || null,
      action: r.action as LegacyUrlRec["action"],
      newPath: r.new_path || null,
      recommendedTarget: r.recommended_target || null,
      entityKey: null,
      decisionStatus: r.decision_status as LegacyUrlRec["decisionStatus"],
      note: r.note || null,
    });
  }
}

/** After content is read: point same_path rows at the record that now serves them. */
export function linkLegacyUrls(parts: BundleParts): void {
  const byPath = new Map<string, string>();
  for (const p of parts.posts) byPath.set(percentDecode(p.legacyUrl), p.key);
  for (const p of parts.pages) if (p.legacyUrl) byPath.set(percentDecode(p.legacyUrl), p.key);
  for (const e of parts.events) byPath.set(percentDecode(e.legacyUrl), e.key);
  for (const u of parts.legacyUrls) {
    const k = byPath.get(u.oldPathDecoded);
    if (k) u.entityKey = k;
    else if (u.action === "same_path" && ["post", "page", "event"].includes(u.legacyType)) {
      parts.warnings.push(`url_map: ${u.oldPath} (${u.legacyType}, same_path) has no imported record`);
    }
  }
}

// Shared types for the legacy WordPress URL and media layer.
// See docs/architecture/LEGACY_URL_AND_MEDIA_LAYER.md.

/** Disposition of one audited URL (docs/audit/inventory/url_map.csv). Paths are decoded UTF-8. */
export interface LegacyUrlRow {
  path: string;
  type: string;
  action: string; // same_path | pending_decision | redirect_301 | redirect_302 | gone_410
  decision: string; // verified | needs_client_approval | client_approved
}

export interface LegacyRedirect {
  /** decoded source path */
  from: string;
  /** decoded target path (site-relative) */
  to: string;
  status: 301 | 302;
}

export interface LegacyUrlData {
  rows: LegacyUrlRow[];
  /** client-approved exact redirects only */
  redirects: LegacyRedirect[];
  /** client-approved removals only (decoded paths) */
  gone: string[];
  /** WordPress post ID → verified decoded path */
  wpPostIds: Record<string, string>;
  /** WordPress page ID → verified decoded path */
  wpPageIds: Record<string, string>;
  /** decoded post slugs with a verified same_path URL */
  postSlugs: string[];
  /** category slugs with a verified same_path archive */
  categorySlugs: string[];
}

export interface LegacyMediaAttachment {
  /** "YYYY/MM" relative to wp-content/uploads, or "" for files at the uploads root */
  dir: string;
  /** candidate source files for resizing, in order of preference (main file, then unscaled original) */
  sources: string[];
  /** resized file names WordPress generated or published pages referenced (name-WxH.ext) */
  sizes: string[];
  evidence: "wp_metadata" | "html_reference";
}

export interface LegacyMediaData {
  attachments: LegacyMediaAttachment[];
}

export type LegacyResolution =
  | { kind: "redirect"; status: 301 | 302; location: string; rule: string }
  | { kind: "gone"; rule: string }
  /** key is the R2 object key, or null when the upload path is malformed (answer 404) */
  | { kind: "media"; key: string | null }
  | { kind: "pass"; reason: PassReason };

export type PassReason =
  | "verified_same_path"
  | "pending_decision"
  | "unknown"
  | "method_not_redirected"
  | "malformed_path"
  | "loop_prevented";

import { createHash } from "node:crypto";
import { decodeHTML } from "entities";

export const SITE_ORIGIN = "https://www.giokerala.org";
export const SITE_TIMEZONE = "Asia/Kolkata";

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** JSON with sorted keys, so the same record always hashes the same. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

export function hashRecord(value: unknown): string {
  return sha256(stableStringify(value));
}

export function decodeEntities(s: string): string {
  return decodeHTML(s);
}

/** Visible text of an HTML fragment, whitespace collapsed. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Google API keys have this fixed shape. The old site exposes one (04 §3.4 C17);
// it must never be copied into D1, R2, reports or git.
const GOOGLE_KEY_RE = /AIza[0-9A-Za-z_-]{35}/g;

export interface Redactions {
  count: number;
}

export function redactSecrets(s: string, r?: Redactions): string {
  return s.replace(GOOGLE_KEY_RE, () => {
    if (r) r.count++;
    return "REDACTED_GOOGLE_API_KEY";
  });
}

export function containsSecret(s: string): boolean {
  GOOGLE_KEY_RE.lastIndex = 0;
  const found = GOOGLE_KEY_RE.test(s);
  GOOGLE_KEY_RE.lastIndex = 0;
  return found;
}

/** WordPress REST `*_gmt` strings carry no zone marker; they are UTC. */
export function wpGmtToMs(gmt: string | null | undefined): number | null {
  if (!gmt || gmt.startsWith("0000")) return null;
  const ms = Date.parse(`${gmt}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Local wall-clock time in Asia/Kolkata (UTC+05:30, no DST) to UTC ms.
 * Used for The Events Calendar dates, which are given in the event's timezone.
 */
export function kolkataLocalToMs(local: string): number {
  const ms = Date.parse(`${local.replace(" ", "T")}+05:30`);
  if (Number.isNaN(ms)) throw new Error(`Invalid local date: ${local}`);
  return ms;
}

/** Full URL or root-relative path on the old site to a path ('/about-us/'). Null for other hosts. */
export function sitePath(url: string): string | null {
  const u = decodeEntities(url).trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u.split("#")[0] || "/";
  const m = /^https?:\/\/(?:www\.)?giokerala\.org(\/[^#]*)?/i.exec(u);
  if (!m) return null;
  return m[1] || "/";
}

/** 'https://www.giokerala.org/wp-content/uploads/2025/08/x-300x200.jpg?ver=1' -> 'wp-content/uploads/2025/08/x-300x200.jpg' */
export function uploadsKey(url: string): string | null {
  const p = sitePath(url);
  if (!p) return null;
  const m = /^\/(wp-content\/uploads\/[^?#]+)/.exec(p);
  return m ? m[1] : null;
}

const SIZE_SUFFIX_RE = /-(\d+)x(\d+)(?=\.[a-z0-9]+$)/i;

/** WordPress resized copy ('-300x200') -> the file it was made from. Leaves '-scaled' and '-e<ts>' alone. */
export function stripSizeSuffix(key: string): string {
  return key.replace(SIZE_SUFFIX_RE, "");
}

export function percentDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Lowercase-hex percent encoding, the form WordPress emits for non-ASCII slugs. */
export function wpEncodePath(decoded: string): string {
  return encodeURI(decoded).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

export function filenameOf(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

export function extOf(key: string): string {
  const f = filenameOf(key);
  const i = f.lastIndexOf(".");
  return i < 0 ? "" : f.slice(i + 1).toLowerCase();
}

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "avif", "bmp"]);
const DOC_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov"]);

export function kindOf(key: string): "image" | "document" | "video" | "other" {
  const e = extOf(key);
  if (IMAGE_EXT.has(e)) return "image";
  if (DOC_EXT.has(e)) return "document";
  if (VIDEO_EXT.has(e)) return "video";
  return "other";
}

export function sortBy<T>(items: T[], key: (t: T) => string | number): T[] {
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

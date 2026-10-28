// Legacy media planning: which R2 objects may answer a /wp-content/uploads/ key and
// which transformation is allowed. Pure; no I/O. Kept separate from redirect resolution.
import type { LegacyMediaData } from "./types.ts";

const RESIZED = /^(.+)-(\d{1,5})x(\d{1,5})\.(jpe?g|png|gif|webp)$/i;

export type OutputFormat = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const FORMAT_BY_EXT: Record<string, OutputFormat> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/** The only transformation options this layer ever sends to the Images binding. */
export interface AllowedTransform {
  width: number;
  height: number;
  fit: "cover";
  format: OutputFormat;
  quality: number;
}

export const TRANSFORM_QUALITY = 85;

export interface MediaIndexEntry {
  width: number;
  height: number;
  /** R2 keys to try as the resize source, in order */
  sources: string[];
  format: OutputFormat;
  evidence: "wp_metadata" | "html_reference";
}

export type MediaIndex = Map<string, MediaIndexEntry>;

/** Builds the allow-list: R2 key of a legacy resized file → how to produce it. */
export function buildMediaIndex(data: LegacyMediaData): MediaIndex {
  const index: MediaIndex = new Map();
  for (const a of data.attachments) {
    const prefix = a.dir ? `wp-content/uploads/${a.dir}/` : "wp-content/uploads/";
    for (const file of a.sizes) {
      const m = RESIZED.exec(file);
      if (!m) throw new Error(`allow-list entry is not a WxH file name: ${a.dir}/${file}`);
      const format = FORMAT_BY_EXT[m[4].toLowerCase()];
      index.set(`${prefix}${file}`, {
        width: Number(m[2]),
        height: Number(m[3]),
        sources: a.sources.map((s) => `${prefix}${s}`),
        format,
        evidence: a.evidence,
      });
    }
  }
  return index;
}

export interface MediaPlan {
  /** always tried first: the exact object (originals, -scaled files, PDFs, and resized copies if stored) */
  direct: string;
  /** null when the key is not an allow-listed resized file: then only the exact object can answer */
  resize: { sources: string[]; transform: AllowedTransform } | null;
}

export function planLegacyMedia(key: string, index: MediaIndex): MediaPlan {
  const entry = index.get(key);
  return {
    direct: key,
    resize: entry
      ? {
          sources: entry.sources,
          transform: { width: entry.width, height: entry.height, fit: "cover", format: entry.format, quality: TRANSFORM_QUALITY },
        }
      : null,
  };
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ...FORMAT_BY_EXT,
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  heic: "image/heic",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  txt: "text/plain; charset=utf-8",
};

/** Fallback Content-Type when an R2 object has no stored metadata. Never sniffed. */
export function contentTypeForKey(key: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(key)?.[1]?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

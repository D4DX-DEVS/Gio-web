// The complete file list (05 §5.2): the union of
//   1. source_url of every media item the REST API lists,
//   2. media_details.original_image (WordPress's unscaled original),
//   3. pre-edit originals of images edited in WordPress (-e<timestamp> filenames),
//   4. every uploads URL referenced in rendered HTML and Elementor CSS (added by the html adapter),
//   5./6. dump / WXR / uploads ZIP entries (phase 6, not available yet).
import type { MediaRec } from "./model";
import type { Snapshot } from "./snapshot";
import { decodeEntities, filenameOf, htmlToText, kindOf, SITE_ORIGIN, stripSizeSuffix, uploadsKey, wpGmtToMs } from "./lib/util";

interface WpSize {
  file: string;
  width: number;
  height: number;
  source_url: string;
}

export interface WpMedia {
  id: number;
  date_gmt: string;
  source_url: string;
  mime_type: string;
  title: { rendered: string };
  caption: { rendered: string };
  alt_text: string;
  media_details?: {
    width?: number;
    height?: number;
    original_image?: string;
    sizes?: Record<string, WpSize>;
  };
}

export const mediaKey = (path: string) => `file:${path}`;

export class MediaIndex {
  /** path -> record */
  readonly byPath = new Map<string, MediaRec>();
  /** WordPress attachment id -> primary path */
  readonly byWpId = new Map<number, string>();
  /** resized copy path -> primary path */
  private readonly sizes = new Map<string, string>();

  constructor(private readonly snap: Snapshot) {}

  private probe(path: string) {
    const h = this.snap.headResults().get(path);
    return { probedStatus: h?.status ?? null, probedBytes: h && h.status === 200 ? h.bytes : null };
  }

  addRestItems(items: WpMedia[]): void {
    for (const m of items) {
      const path = uploadsKey(m.source_url);
      if (!path) continue;
      const md = m.media_details ?? {};
      const title = htmlToText(m.title.rendered) || null;
      const caption = htmlToText(m.caption.rendered) || null;
      const primary: MediaRec = {
        key: mediaKey(path),
        source: "wp_rest",
        sourceRef: `wp:attachment:${m.id}`,
        reviewState: "verified",
        path,
        kind: kindOf(path),
        usageHint: null,
        originalFilename: filenameOf(path),
        declaredMimeType: m.mime_type || null,
        title,
        caption,
        // All 301 items have empty alt text today (04 §2 #2). Never invented.
        altText: m.alt_text?.trim() ? decodeEntities(m.alt_text.trim()) : null,
        legacyWpId: m.id,
        legacyUrl: `${SITE_ORIGIN}/${path}`,
        variantOf: null,
        variantRole: null,
        // 'full' is the attachment itself, not a resized copy.
        legacySizes: Object.entries(md.sizes ?? {})
          .filter(([name, sz]) => name !== "full" && sz.file && sz.width && sz.height)
          .map(([name, sz]) => ({ name, file: sz.file, width: sz.width, height: sz.height }))
          .sort((a, b) => a.width - b.width || a.name.localeCompare(b.name)),
        declaredWidth: md.width ?? null,
        declaredHeight: md.height ?? null,
        ...this.probe(path),
        createdAtMs: wpGmtToMs(m.date_gmt),
      };
      this.byPath.set(path, primary);
      this.byWpId.set(m.id, path);

      const dir = path.slice(0, path.lastIndexOf("/") + 1);
      for (const s of Object.values(md.sizes ?? {})) {
        const sp = uploadsKey(s.source_url);
        if (sp && sp !== path) this.sizes.set(sp, path);
      }

      const variant = (vpath: string, role: NonNullable<MediaRec["variantRole"]>) => {
        if (this.byPath.has(vpath)) return;
        this.byPath.set(vpath, {
          ...primary,
          key: mediaKey(vpath),
          sourceRef: `wp:attachment:${m.id}:${role}`,
          path: vpath,
          kind: kindOf(vpath),
          originalFilename: filenameOf(vpath),
          declaredMimeType: null,
          legacyWpId: m.id,
          legacyUrl: `${SITE_ORIGIN}/${vpath}`,
          variantOf: primary.key,
          variantRole: role,
          legacySizes: [],
          declaredWidth: null,
          declaredHeight: null,
          ...this.probe(vpath),
        });
      };

      // Edited images keep their unedited file on disk: 'x-scaled-e1768740565344.jpg' -> 'x-scaled.jpg'.
      const preEdit = path.replace(/-e\d{10,}(?=\.[a-z0-9]+$)/i, "");
      if (preEdit !== path) variant(preEdit, "wp_pre_edit_original");
      if (md.original_image) variant(dir + md.original_image, "wp_unscaled_original");
    }
  }

  /**
   * Any uploads path seen in content (possibly a resized copy) -> the path of the file to serve.
   * Resized copies ('-300x200') are not stored; they map to their original (05 §5.1).
   */
  resolve(path: string): string {
    if (this.byPath.has(path)) return path;
    const viaSize = this.sizes.get(path);
    if (viaSize) return viaSize;
    const stripped = stripSizeSuffix(path);
    if (this.byPath.has(stripped)) return stripped;
    const scaled = stripped.replace(/(\.[a-z0-9]+)$/i, "-scaled$1");
    if (this.byPath.has(scaled)) return scaled;
    return stripped;
  }

  /** A file referenced by public HTML or CSS that the REST API does not list (05 §5.3). */
  addReferenced(path: string, source: "html_parse" | "css_parse", ref: string): MediaRec {
    const resolved = this.resolve(path);
    const existing = this.byPath.get(resolved);
    if (existing) return existing;
    const rec: MediaRec = {
      key: mediaKey(resolved),
      source,
      sourceRef: ref,
      reviewState: "verified",
      path: resolved,
      kind: kindOf(resolved),
      usageHint: null,
      originalFilename: filenameOf(resolved),
      declaredMimeType: null,
      title: null,
      caption: null,
      altText: null,
      legacyWpId: null,
      legacyUrl: `${SITE_ORIGIN}/${resolved}`,
      variantOf: null,
      variantRole: null,
      legacySizes: [],
      declaredWidth: null,
      declaredHeight: null,
      ...this.probe(resolved),
      createdAtMs: null,
    };
    this.byPath.set(resolved, rec);
    return rec;
  }

  keyForWpId(id: number | null | undefined): string | null {
    if (!id) return null;
    const p = this.byWpId.get(id);
    return p ? mediaKey(p) : null;
  }

  all(): MediaRec[] {
    return [...this.byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
}

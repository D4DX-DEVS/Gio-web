// Helpers for admin uploads: type sniffing, image dimensions and R2 keys.
// Upload types are decided from the file's bytes, never from its name or the browser's claim.

export const LIMITS = { image: 15 * 1024 * 1024, document: 50 * 1024 * 1024 };

export interface Sniffed {
  mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
  kind: "image" | "document";
  ext: string;
}

/** Only these types are accepted. SVG is refused: it can carry scripts. */
export function sniff(b: Uint8Array): Sniffed | null {
  const s = (o: number, l: number) => String.fromCharCode(...b.subarray(o, o + l));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image", ext: "jpg" };
  if (b[0] === 0x89 && s(1, 3) === "PNG") return { mime: "image/png", kind: "image", ext: "png" };
  if (s(0, 4) === "GIF8") return { mime: "image/gif", kind: "image", ext: "gif" };
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return { mime: "image/webp", kind: "image", ext: "webp" };
  if (s(0, 5) === "%PDF-") return { mime: "application/pdf", kind: "document", ext: "pdf" };
  return null;
}

/** Width and height from the file header (JPEG, PNG, GIF, WebP). Null if unreadable. */
export function dimensions(b: Uint8Array, mime: string): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (mime === "image/png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
    if (mime === "image/gif") return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
    if (mime === "image/webp") {
      const chunk = String.fromCharCode(...b.subarray(12, 16));
      if (chunk === "VP8X") return { width: 1 + (dv.getUint32(24, true) & 0xffffff), height: 1 + (dv.getUint32(27, true) & 0xffffff) };
      if (chunk === "VP8L") {
        const bits = dv.getUint32(21, true);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
      }
      if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      return null;
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1];
        const len = dv.getUint16(i + 2);
        // SOF0-SOF15 except DHT (C4), JPG (C8) and DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function sha256Hex(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const FOLDERS = ["images", "banners", "leaders", "logos", "documents"] as const;
export type Folder = (typeof FOLDERS)[number];

/** Immutable key for a new upload (05 §5.1): <folder>/[YYYY/MM/]<random>-<ascii slug>.<ext> */
export function newKey(folder: Folder, originalName: string, ext: string, now = new Date()): string {
  const slug =
    originalName
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "file";
  const rand = [...crypto.getRandomValues(new Uint8Array(6))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const dated = folder === "leaders" || folder === "logos" ? "" : `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/`;
  return `${folder}/${dated}${rand}-${slug}.${ext}`;
}

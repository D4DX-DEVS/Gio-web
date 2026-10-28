// `files` step (05 §3, §5.2): fetch the bytes of every file in the bundle's file list into a local,
// git-ignored cache, then record size, sha256, sniffed MIME and dimensions in a manifest.
//
// This is the only step that contacts the live site, and only with GET requests for public
// /wp-content/uploads/ files, one at a time, rate-limited, identified in the User-Agent.
// Files already in the cache with a recorded hash are never fetched again.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { imageSize } from "image-size";
import type { Bundle } from "./model";
import { SITE_ORIGIN, sha256 } from "./lib/util";

export interface FileEntry {
  path: string;
  status: "available" | "missing" | "error";
  httpStatus: number | null;
  bytes: number | null;
  sha256: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  contentLength: number | null;
  /** Bytes the audit's HEAD request reported, when it probed this file. */
  auditBytes: number | null;
  fetchedAt: string | null;
  note: string | null;
}

export type Manifest = Record<string, FileEntry>;

export const manifestPath = (cacheDir: string) => join(cacheDir, "manifest.json");

export function readManifest(cacheDir: string): Manifest {
  const p = manifestPath(cacheDir);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Manifest) : {};
}

function writeManifest(cacheDir: string, m: Manifest) {
  const sorted = Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
  const p = manifestPath(cacheDir);
  writeFileSync(`${p}.tmp`, JSON.stringify(sorted, null, 1));
  renameSync(`${p}.tmp`, p);
}

/** MIME type from the first bytes. WordPress's declared type is not trusted (2 items say text/xml). */
export function sniffMime(b: Uint8Array): string {
  const s = (o: number, l: number) => String.fromCharCode(...b.subarray(o, o + l));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && s(1, 3) === "PNG") return "image/png";
  if (s(0, 4) === "GIF8") return "image/gif";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "image/webp";
  if (s(0, 5) === "%PDF-") return "application/pdf";
  if (s(4, 4) === "ftyp") {
    const brand = s(8, 4);
    if (["heic", "heix", "hevc", "mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
    if (brand === "avif") return "image/avif";
    return "video/mp4";
  }
  const head = s(0, 256).trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  if (s(0, 2) === "PK") return "application/zip";
  return "application/octet-stream";
}

function dimensions(b: Uint8Array, mime: string): { width: number | null; height: number | null } {
  if (!mime.startsWith("image/")) return { width: null, height: null };
  try {
    const d = imageSize(b);
    // EXIF orientation 5-8 means the stored image is rotated a quarter turn.
    const rotated = d.orientation !== undefined && d.orientation >= 5;
    return { width: (rotated ? d.height : d.width) ?? null, height: (rotated ? d.width : d.height) ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export function cacheFile(cacheDir: string, path: string) {
  return join(cacheDir, "files", ...path.split("/"));
}

export interface FetchOptions {
  cacheDir: string;
  delayMs: number;
  limit?: number;
  dryRun: boolean;
  log: (s: string) => void;
  fetchImpl?: typeof fetch;
  origin?: string;
}

export async function fetchFiles(bundle: Bundle, opts: FetchOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const origin = opts.origin ?? SITE_ORIGIN;
  mkdirSync(opts.cacheDir, { recursive: true });
  const manifest = readManifest(opts.cacheDir);
  const todo = bundle.media.filter((m) => {
    const e = manifest[m.path];
    return !(e?.status === "available" && e.sha256 && existsSync(cacheFile(opts.cacheDir, m.path)));
  });
  const queue = opts.limit ? todo.slice(0, opts.limit) : todo;
  opts.log(`files: ${bundle.media.length} in list, ${bundle.media.length - todo.length} already cached, ${queue.length} to fetch${opts.dryRun ? " (dry run: nothing fetched)" : ""}`);
  if (opts.dryRun) return { fetched: 0, failed: 0, manifest };

  let fetched = 0;
  let failed = 0;
  for (const [i, m] of queue.entries()) {
    const target = `${origin}/${m.path.split("/").map(encodeURIComponent).join("/")}`;
    const base: FileEntry = {
      path: m.path,
      status: "error",
      httpStatus: null,
      bytes: null,
      sha256: null,
      mime: null,
      width: null,
      height: null,
      contentLength: null,
      auditBytes: m.probedBytes,
      fetchedAt: new Date().toISOString(),
      note: null,
    };
    try {
      const res = await doFetch(target, {
        headers: { "User-Agent": "GIOKeralaMigration/1.0 (site rebuild; read-only file copy)" },
        redirect: "follow",
        signal: AbortSignal.timeout(120_000),
      });
      base.httpStatus = res.status;
      const cl = res.headers.get("content-length");
      base.contentLength = cl ? Number(cl) : null;
      if (res.status === 404 || res.status === 410) {
        manifest[m.path] = { ...base, status: "missing", note: `HTTP ${res.status} on the live site` };
        failed++;
      } else if (!res.ok) {
        manifest[m.path] = { ...base, note: `HTTP ${res.status}` };
        failed++;
      } else {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (base.contentLength !== null && base.contentLength !== bytes.length) {
          manifest[m.path] = { ...base, note: `truncated: got ${bytes.length} of ${base.contentLength} bytes` };
          failed++;
        } else {
          const file = cacheFile(opts.cacheDir, m.path);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, bytes);
          const mime = sniffMime(bytes);
          const notes: string[] = [];
          if (m.probedBytes !== null && m.probedBytes !== bytes.length) notes.push(`size differs from audit HEAD (${m.probedBytes})`);
          if (mime.startsWith("text/") || mime === "application/octet-stream") notes.push(`unrecognised content (${mime})`);
          manifest[m.path] = {
            ...base,
            status: "available",
            bytes: bytes.length,
            sha256: sha256(bytes),
            mime,
            ...dimensions(bytes, mime),
            note: notes.join("; ") || null,
          };
          fetched++;
        }
      }
    } catch (e) {
      manifest[m.path] = { ...base, note: `request failed: ${(e as Error).message}` };
      failed++;
    }
    const e = manifest[m.path];
    opts.log(`  [${i + 1}/${queue.length}] ${e.status.padEnd(9)} ${m.path}${e.note ? `  (${e.note})` : ""}`);
    if ((i + 1) % 10 === 0) writeManifest(opts.cacheDir, manifest);
    if (i + 1 < queue.length) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  writeManifest(opts.cacheDir, manifest);
  return { fetched, failed, manifest };
}

/** Re-hash every cached file against the manifest (integrity check without network). */
export function verifyCache(cacheDir: string): { ok: number; bad: string[] } {
  const manifest = readManifest(cacheDir);
  const bad: string[] = [];
  let ok = 0;
  for (const e of Object.values(manifest)) {
    if (e.status !== "available") continue;
    const f = cacheFile(cacheDir, e.path);
    if (!existsSync(f) || sha256(readFileSync(f)) !== e.sha256) bad.push(e.path);
    else ok++;
  }
  return { ok, bad };
}

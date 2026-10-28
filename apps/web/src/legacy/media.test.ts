// Legacy media: allow-list derived from the audit, and handler behaviour with fake
// R2 / Images / Cache bindings. Image bytes here are synthetic placeholders; no client
// media is used or required.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { LEGACY_MEDIA_DATA } from "./generated/legacy-media-data.ts";
import {
  CACHE_FALLBACK,
  CACHE_IMMUTABLE,
  CACHE_NOT_FOUND,
  handleLegacyMedia,
  MAX_TRANSFORM_INPUT_BYTES,
  type MediaBucket,
  type MediaCache,
  type MediaImages,
  type MediaObject,
} from "./media-handler.ts";
import { buildMediaIndex, planLegacyMedia, TRANSFORM_QUALITY } from "./media-plan.ts";
import { uploadKeyFromPathname } from "./paths.ts";
import { hasSnapshot, readInventory, readSnapshotJson, SNAPSHOT } from "./testing/audit-data.ts";

const ORIGIN = "https://www.giokerala.org";
const index = buildMediaIndex(LEGACY_MEDIA_DATA);
const RESIZED = /^(.+)-(\d+)x(\d+)\.(jpe?g|png|gif|webp)$/i;

// A real attachment from the audit with a "-scaled" main file and an unscaled original
const scaled = LEGACY_MEDIA_DATA.attachments.find((a) => a.sources.length === 2 && a.sources[0].includes("-scaled."))!;
const DIR = `wp-content/uploads/${scaled.dir}`;
const MAIN = `${DIR}/${scaled.sources[0]}`;
const ORIGINAL = `${DIR}/${scaled.sources[1]}`;
const SIZE = scaled.sizes[0];
const [, , W, H] = RESIZED.exec(SIZE)!;

describe("allow-list derived from the audit", () => {
  test("every allow-listed size of WordPress metadata is exactly a size in the frozen REST media list", { skip: !hasSnapshot }, () => {
    type Media = { source_url: string; media_details: { sizes?: Record<string, { file: string; width: number; height: number }> } };
    const media = readSnapshotJson<Media[]>("rest/media.json");
    const expected = new Set<string>();
    for (const m of media) {
      const main = decodeURIComponent(new URL(m.source_url).pathname).slice(1);
      const dir = main.slice(0, main.lastIndexOf("/"));
      for (const s of Object.values(m.media_details.sizes ?? {})) {
        const mm = RESIZED.exec(s.file);
        if (`${dir}/${s.file}` !== main && mm && Number(mm[2]) === s.width && Number(mm[3]) === s.height) expected.add(`${dir}/${s.file}`);
      }
    }
    const fromMetadata = [...index].filter(([, e]) => e.evidence === "wp_metadata").map(([k]) => k);
    assert.equal(fromMetadata.length, expected.size);
    for (const k of fromMetadata) assert.ok(expected.has(k), k);
  });

  test("every resized image referenced by the frozen pages is allowed, unless its original is unknown", { skip: !hasSnapshot }, () => {
    const assets = new Set(readInventory("asset_inventory.csv").map((a) => decodeURIComponent(new URL(a.file_url).pathname).slice(1)));
    const refs = new Set<string>();
    const pattern = /wp-content\/uploads\/([^"'\s)?#<>\\]+?-\d+x\d+\.(?:jpe?g|png|gif|webp))/gi;
    for (const dir of ["html", "css"]) {
      for (const f of readdirSync(`${SNAPSHOT}${dir}`)) {
        for (const m of readFileSync(`${SNAPSHOT}${dir}/${f}`, "utf8").matchAll(pattern)) refs.add(`wp-content/uploads/${decodeURIComponent(m[1])}`);
      }
    }
    const notAllowed = [...refs].filter((r) => !index.has(r));
    for (const r of notAllowed) {
      const [, base, , , ext] = RESIZED.exec(r)!;
      assert.ok(!assets.has(`${base}.${ext}`), `${r} is referenced and its original is known, so it must be allowed`);
    }
    // Recorded so a change is noticed: the one unresolvable reference is a theme-demo image
    assert.deepEqual(notAllowed, ["wp-content/uploads/2020/10/event-14-370x270.jpg"]);
  });

  test("sources are ordered main file first (the -scaled copy), then the unscaled original", () => {
    const plan = planLegacyMedia(`${DIR}/${SIZE}`, index);
    assert.deepEqual(plan.resize?.sources, [MAIN, ORIGINAL]);
    assert.deepEqual(plan.resize?.transform, { width: Number(W), height: Number(H), fit: "cover", format: "image/jpeg", quality: TRANSFORM_QUALITY });
  });

  test("names that are not allow-listed get no transformation", () => {
    for (const k of [`${DIR}/${scaled.sources[1].replace(/\.jpg$/, "-123x456.jpg")}`, `${DIR}/nope-300x200.jpg`, MAIN, "wp-content/uploads/2099/01/x-300x200.png"]) {
      assert.equal(planLegacyMedia(k, index).resize, null, k);
    }
  });
});

// ---------------------------------------------------------------- fakes
const bytes = (s: string) => new TextEncoder().encode(s);
const stream = (b: Uint8Array) => new Response(new Uint8Array(b)).body!;

class FakeBucket implements MediaBucket {
  gets: string[] = [];
  objects: Record<string, { body: Uint8Array; contentType?: string; size?: number }>;
  constructor(objects: Record<string, { body: Uint8Array; contentType?: string; size?: number }>) {
    this.objects = objects;
  }
  async get(key: string, options?: { onlyIf?: Headers; range?: Headers }): Promise<MediaObject | null> {
    this.gets.push(key);
    const o = this.objects[key];
    if (!o) return null;
    const etag = `"etag-${key.length}"`;
    const base = { size: o.size ?? o.body.length, httpEtag: etag, uploaded: new Date("2026-10-01T00:00:00Z"), httpMetadata: o.contentType ? { contentType: o.contentType } : undefined };
    if (options?.onlyIf?.get("If-None-Match") === etag) return base;
    const range = /^bytes=(\d+)-(\d+)$/.exec(options?.range?.get("Range") ?? "");
    if (range) {
      const [start, end] = [Number(range[1]), Number(range[2])];
      return { ...base, range: { offset: start, length: end - start + 1 }, body: stream(o.body.slice(start, end + 1)) };
    }
    return { ...base, body: stream(o.body) };
  }
}

class FakeImages implements MediaImages {
  calls: Array<{ transform: unknown; output: unknown }> = [];
  fail: boolean;
  constructor(fail = false) {
    this.fail = fail;
  }
  input(s: ReadableStream<Uint8Array>) {
    return {
      transform: (t: { width: number; height: number; fit: "cover" }) => ({
        output: async (o: { format: string; quality: number }) => {
          this.calls.push({ transform: t, output: o });
          await new Response(s).arrayBuffer();
          if (this.fail) throw new Error("ImagesError 9422");
          return { response: () => new Response(`RESIZED ${t.width}x${t.height}`, { headers: { "Content-Type": o.format } }) };
        },
      }),
    };
  }
}

class FakeCache implements MediaCache {
  store = new Map<string, Response>();
  async match(r: Request) {
    return this.store.get(r.url)?.clone();
  }
  async put(r: Request, res: Response) {
    this.store.set(r.url, res);
  }
}

const get = (path: string, init: RequestInit = {}) => new Request(`${ORIGIN}/${path}`, init);
const serve = (req: Request, ctx: Parameters<typeof handleLegacyMedia>[3]) => handleLegacyMedia(req, uploadKeyFromPathname(new URL(req.url).pathname), index, ctx);

describe("media handler", () => {
  test("original served directly from R2 with long-lived cache and safe headers", async () => {
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("JPEGDATA"), contentType: "image/jpeg" } });
    const res = await serve(get(MAIN), { bucket });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "JPEGDATA");
    assert.equal(res.headers.get("Content-Type"), "image/jpeg");
    assert.equal(res.headers.get("Cache-Control"), CACHE_IMMUTABLE);
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(res.headers.get("Content-Security-Policy") ?? "", /sandbox/);
    assert.ok(res.headers.get("ETag"));
  });

  test("Content-Type falls back to the extension, never to sniffing", async () => {
    const bucket = new FakeBucket({ "wp-content/uploads/2026/09/doc.pdf": { body: bytes("%PDF") } });
    const res = await serve(get("wp-content/uploads/2026/09/doc.pdf"), { bucket });
    assert.equal(res.headers.get("Content-Type"), "application/pdf");
  });

  test("a stored resized copy is served directly; the Images binding is not used", async () => {
    const images = new FakeImages();
    const bucket = new FakeBucket({ [`${DIR}/${SIZE}`]: { body: bytes("STORED-WP-COPY") }, [MAIN]: { body: bytes("MAIN") } });
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket, images });
    assert.equal(await res.text(), "STORED-WP-COPY");
    assert.equal(res.headers.get("X-Legacy-Media"), "direct");
    assert.equal(images.calls.length, 0);
  });

  test("an allow-listed size is produced from the -scaled original with the fixed options, then cached", async () => {
    const images = new FakeImages();
    const cache = new FakeCache();
    const pending: Promise<unknown>[] = [];
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("MAIN") }, [ORIGINAL]: { body: bytes("ORIGINAL") } });
    const ctx = { bucket, images, cache, waitUntil: (p: Promise<unknown>) => void pending.push(p) };
    const res = await serve(get(`${DIR}/${SIZE}`), ctx);
    await Promise.all(pending);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), `RESIZED ${W}x${H}`);
    assert.equal(res.headers.get("Cache-Control"), CACHE_IMMUTABLE);
    assert.equal(res.headers.get("X-Legacy-Media"), "resized");
    assert.deepEqual(images.calls, [{ transform: { width: Number(W), height: Number(H), fit: "cover" }, output: { format: "image/jpeg", quality: TRANSFORM_QUALITY } }]);
    assert.ok(!bucket.gets.includes(ORIGINAL), "the unscaled original is not read when the -scaled file exists");
    // second request: answered from the cache, no new transformation
    const again = await serve(get(`${DIR}/${SIZE}?ignored=1`), ctx);
    assert.equal(await again.text(), `RESIZED ${W}x${H}`);
    assert.equal(images.calls.length, 1);
  });

  test("falls back to the unscaled original when the -scaled file is absent", async () => {
    const images = new FakeImages();
    const bucket = new FakeBucket({ [ORIGINAL]: { body: bytes("ORIGINAL") } });
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket, images });
    assert.equal(res.status, 200);
    assert.deepEqual(bucket.gets, [`${DIR}/${SIZE}`, MAIN, ORIGINAL]);
  });

  test("sources over the 20 MB Images input limit are skipped", async () => {
    const images = new FakeImages();
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("BIG"), size: MAX_TRANSFORM_INPUT_BYTES + 1 }, [ORIGINAL]: { body: bytes("OK") } });
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket, images });
    assert.equal(res.headers.get("X-Legacy-Media"), "resized");
    assert.equal(images.calls.length, 1);
  });

  test("missing originals: clear 404 with a short cache, nothing fabricated", async () => {
    const images = new FakeImages();
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket: new FakeBucket({}), images });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("Cache-Control"), CACHE_NOT_FOUND);
    assert.equal(images.calls.length, 0);
    assert.doesNotMatch(await res.text(), /[A-Z]:\\|\/c\/|snapshot|wp-content/i, "no paths leak into the error");
  });

  test("a size that is not allow-listed is rejected even when the original exists", async () => {
    const images = new FakeImages();
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("MAIN") }, [ORIGINAL]: { body: bytes("ORIGINAL") } });
    const stem = scaled.sources[1].replace(/\.jpg$/, "");
    for (const name of [`${stem}-123x456.jpg`, `${stem}-4000x4000.jpg`, `${stem}-1x1.jpg`]) {
      const res = await serve(get(`${DIR}/${name}`), { bucket, images });
      assert.equal(res.status, 404, name);
    }
    assert.equal(images.calls.length, 0);
  });

  test("Images binding failure: safe fallback to the real original, not cached", async () => {
    const cache = new FakeCache();
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("MAIN"), contentType: "image/jpeg" } });
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket, images: new FakeImages(true), cache });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "MAIN");
    assert.equal(res.headers.get("Cache-Control"), CACHE_FALLBACK);
    assert.equal(res.headers.get("X-Legacy-Media"), "fallback-original");
    assert.equal(cache.store.size, 0);
  });

  test("no Images binding configured: same safe fallback", async () => {
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("MAIN") } });
    const res = await serve(get(`${DIR}/${SIZE}`), { bucket });
    assert.equal(res.headers.get("X-Legacy-Media"), "fallback-original");
  });

  test("HEAD returns headers only; other methods get 405", async () => {
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("JPEGDATA") } });
    const head = await serve(get(MAIN, { method: "HEAD" }), { bucket });
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
    const post = await serve(get(MAIN, { method: "POST" }), { bucket });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("Allow"), "GET, HEAD");
  });

  test("conditional request → 304; range request → 206", async () => {
    const bucket = new FakeBucket({ [MAIN]: { body: bytes("0123456789") } });
    const first = await serve(get(MAIN), { bucket });
    const etag = first.headers.get("ETag")!;
    const notModified = await serve(get(MAIN, { headers: { "If-None-Match": etag } }), { bucket });
    assert.equal(notModified.status, 304);
    const partial = await serve(get(MAIN, { headers: { Range: "bytes=2-5" } }), { bucket });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("Content-Range"), "bytes 2-5/10");
    assert.equal(await partial.text(), "2345");
  });

  test("malformed upload path → 404 without touching R2", async () => {
    const bucket = new FakeBucket({});
    const res = await handleLegacyMedia(get("wp-content/uploads/a%2Fb.jpg"), null, index, { bucket });
    assert.equal(res.status, 404);
    assert.equal(bucket.gets.length, 0);
  });
});

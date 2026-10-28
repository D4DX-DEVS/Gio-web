// Serves /wp-content/uploads/* from R2. Answers, in order:
//   1. the exact object (originals, -scaled files, documents, stored resized copies)
//   2. for an allow-listed resized name only: the first existing source resized through
//      the Images binding with the fixed options in media-plan.ts, cached in the Cache API
//   3. 404. Nothing is guessed: a missing original is never assumed to exist.
// Bindings are passed in as small interfaces so the logic can be tested without workerd.
import { contentTypeForKey, planLegacyMedia, type MediaIndex, type OutputFormat } from "./media-plan.ts";

/** Cloudflare's documented Images binding input limit. */
export const MAX_TRANSFORM_INPUT_BYTES = 20 * 1024 * 1024;

export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
export const CACHE_NOT_FOUND = "public, max-age=300";
export const CACHE_FALLBACK = "no-store";

// Uploaded files are untrusted content; never let one run as a page (e.g. an SVG with script).
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
};

export interface MediaObject {
  size: number;
  httpEtag: string;
  uploaded?: Date;
  httpMetadata?: { contentType?: string };
  range?: { offset?: number; length?: number; suffix?: number };
  body?: ReadableStream<Uint8Array>;
}

export interface MediaBucket {
  get(key: string, options?: { onlyIf?: Headers; range?: Headers }): Promise<MediaObject | null>;
}

export interface MediaImages {
  input(stream: ReadableStream<Uint8Array>): {
    transform(t: { width: number; height: number; fit: "cover" }): {
      output(o: { format: OutputFormat; quality: number }): Promise<{ response(): Response }>;
    };
  };
}

export interface MediaCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface MediaContext {
  bucket: MediaBucket;
  images?: MediaImages;
  cache?: MediaCache;
  waitUntil?: (p: Promise<unknown>) => void;
}

export async function handleLegacyMedia(request: Request, key: string | null, index: MediaIndex, ctx: MediaContext): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return finish(method, new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": CACHE_NOT_FOUND } }));
  }
  if (key === null) return notFound(method);

  const plan = planLegacyMedia(key, index);

  // 1. Exact object, with conditional and range support
  const direct = await ctx.bucket.get(plan.direct, { onlyIf: request.headers, range: request.headers });
  if (direct) return finish(method, objectResponse(direct, request, plan.direct, "direct"));

  // 2. Allow-listed resized copy
  if (!plan.resize) return notFound(method);
  const url = new URL(request.url);
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  const cached = await ctx.cache?.match(cacheKey);
  if (cached) return finish(method, cached);

  let fallback: string | null = null;
  for (const sourceKey of plan.resize.sources) {
    const source = await ctx.bucket.get(sourceKey);
    if (!source?.body) continue;
    fallback ??= sourceKey;
    if (source.size > MAX_TRANSFORM_INPUT_BYTES || !ctx.images) {
      await source.body.cancel();
      continue;
    }
    try {
      const { width, height, fit, format, quality } = plan.resize.transform;
      const result = await ctx.images.input(source.body).transform({ width, height, fit }).output({ format, quality });
      const transformed = result.response();
      if (!transformed.ok || !transformed.body) throw new Error(`Images binding answered ${transformed.status}`);
      const headers = new Headers(SECURITY_HEADERS);
      headers.set("Content-Type", transformed.headers.get("Content-Type") ?? format);
      headers.set("Cache-Control", CACHE_IMMUTABLE);
      headers.set("X-Legacy-Media", "resized");
      const response = new Response(transformed.body, { status: 200, headers });
      if (ctx.cache) {
        const stored = ctx.cache.put(cacheKey, response.clone());
        if (ctx.waitUntil) ctx.waitUntil(stored);
        else await stored;
      }
      return finish(method, response);
    } catch {
      // try the next source; if none works, fall back to the real original below
    }
  }

  // 3. Safe fallback: the real, unresized source image, not cached. Otherwise 404.
  if (fallback) {
    const source = await ctx.bucket.get(fallback);
    if (source?.body) {
      const response = objectResponse(source, request, fallback, "fallback-original");
      response.headers.set("Cache-Control", CACHE_FALLBACK);
      return finish(method, response);
    }
  }
  return notFound(method);
}

function objectResponse(obj: MediaObject, request: Request, key: string, how: string): Response {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set("Content-Type", obj.httpMetadata?.contentType || contentTypeForKey(key));
  headers.set("Cache-Control", CACHE_IMMUTABLE);
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  if (obj.uploaded) headers.set("Last-Modified", obj.uploaded.toUTCString());
  headers.set("X-Legacy-Media", how);

  // R2 returns an object without a body when an If-None-Match / If-Modified-Since precondition fails
  if (!obj.body) return new Response(null, { status: 304, headers });

  if (request.headers.has("Range") && obj.range) {
    const { offset, length, suffix } = obj.range;
    const start = suffix !== undefined ? obj.size - suffix : (offset ?? 0);
    const len = suffix !== undefined ? suffix : (length ?? obj.size - start);
    headers.set("Content-Range", `bytes ${start}-${start + len - 1}/${obj.size}`);
    headers.set("Content-Length", String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

function notFound(method: string): Response {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", CACHE_NOT_FOUND);
  return finish(method, new Response("Not Found", { status: 404, headers }));
}

function finish(method: string, response: Response): Response {
  if (method !== "HEAD" || response.body === null) return response;
  void response.body.cancel();
  return new Response(null, { status: response.status, headers: response.headers });
}

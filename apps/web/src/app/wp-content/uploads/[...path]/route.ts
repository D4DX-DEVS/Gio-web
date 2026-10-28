// Spike C: serve legacy WordPress upload URLs from R2.
//   /wp-content/uploads/YYYY/MM/<name>.<ext>          → R2 key lookup (byte-exact path)
//   /wp-content/uploads/YYYY/MM/<name>-<W>x<H>.<ext>  → original (or "-scaled" original) resized
//                                                        through the Cloudflare Images binding
// 05-MIGRATION-DESIGN.md §5.1 / §6.1. Spike only: no caching, no allow-list of sizes yet.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound, spikesEnabled } from "@/lib/spikes";

// groups: base, width, height, extension
const RESIZED = /^(.+)-(\d{1,4})x(\d{1,4})\.(jpe?g|png|gif|webp)$/i;
const MIME: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!spikesEnabled()) return notFound();
  const { path } = await ctx.params;
  const { env } = getCloudflareContext();
  // Keys are stored exactly as WordPress wrote them (decoded UTF-8)
  const key = "wp-content/uploads/" + path.map((p) => decodeURIComponent(p)).join("/");

  const direct = await env.MEDIA.get(key);
  if (direct) {
    const headers = new Headers({ "x-spike-media": "direct" });
    direct.writeHttpMetadata(headers);
    headers.set("etag", direct.httpEtag);
    return new Response(direct.body, { headers });
  }

  const m = RESIZED.exec(key);
  if (!m) return notFound();
  const [, base, w, h, ext] = m;
  const width = Number(w);
  const height = Number(h);

  // WordPress derives sizes from the unscaled upload; the attachment's main file may be "-scaled"
  let originalKey = `${base}.${ext}`;
  let original = await env.MEDIA.get(originalKey);
  if (!original) {
    originalKey = `${base}-scaled.${ext}`;
    original = await env.MEDIA.get(originalKey);
  }
  if (!original) return notFound();

  if (!env.IMAGES) return Response.json({ error: "IMAGES binding missing" }, { status: 500 });
  const format = MIME[ext.toLowerCase()];
  try {
    const result = await env.IMAGES.input(original.body)
      .transform({ width, height, fit: "cover" })
      .output({ format: format === "image/gif" ? "image/png" : format });
    const res = result.response();
    const headers = new Headers(res.headers);
    headers.set("x-spike-media", `resized-from=${originalKey}`);
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return Response.json({ error: (e as Error).message, originalKey }, { status: 502 });
  }
}

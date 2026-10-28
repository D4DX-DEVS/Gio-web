// Serves files from the public MEDIA bucket: new uploads at /media/<key>, and (in `next dev` only,
// through the rewrite in next.config.ts) legacy /wp-content/uploads/* paths. Only keys recorded in
// the media table as public, available and not deleted are served; files are returned as stored,
// with no resizing or other transformation.
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@gio/db";
import { getDb, getEnv } from "@/lib/db";

export async function GET(req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key: parts } = await ctx.params;
  let key: string;
  try {
    key = parts.map((p) => decodeURIComponent(p)).join("/");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (key.includes("..")) return new Response("Not found", { status: 404 });

  const [row] = await getDb()
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(and(eq(schema.media.r2Key, key), eq(schema.media.isPublic, true), eq(schema.media.fileStatus, "available"), isNull(schema.media.deletedAt)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const obj = await getEnv().MEDIA.get(key, { onlyIf: req.headers });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", key.startsWith("wp-content/") ? "public, max-age=86400" : "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (!("body" in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
}

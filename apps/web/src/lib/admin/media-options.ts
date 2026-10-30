import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema, type Db } from "@gio/db";
import { mediaPublicPath } from "@gio/db/layout";
import { encodePath } from "@/lib/content";
import type { MediaOption } from "./client";

/** Every usable image (originals only, not WordPress scaled variants), newest first, for MediaPicker. */
export async function listImageOptions(db: Db): Promise<MediaOption[]> {
  const m = schema.media;
  const rows = await db
    .select({ id: m.id, r2Key: m.r2Key, name: m.originalFilename, alt: m.altText })
    .from(m)
    .where(and(eq(m.kind, "image"), eq(m.fileStatus, "available"), isNull(m.deletedAt), isNull(m.variantOfMediaId)))
    .orderBy(desc(m.id));
  return rows.map((r) => ({ id: r.id, url: mediaUrl(r.r2Key), name: r.name, alt: r.alt }));
}

/** MediaPicker previews for the given ids (any kind, including deleted, so a broken reference still shows its id). */
export async function mediaPreviews(db: Db, ids: (number | null | undefined)[]): Promise<Map<number, MediaOption>> {
  const unique = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!unique.length) return new Map();
  const m = schema.media;
  const rows = await db.select({ id: m.id, r2Key: m.r2Key, name: m.originalFilename, alt: m.altText }).from(m).where(inArray(m.id, unique));
  return new Map(rows.map((r) => [r.id, { id: r.id, url: mediaUrl(r.r2Key), name: r.name, alt: r.alt }]));
}

/** Browser-safe URL for an R2 key (keys are stored decoded; some contain spaces or Malayalam). */
export function mediaUrl(r2Key: string): string {
  return encodePath(mediaPublicPath(r2Key));
}

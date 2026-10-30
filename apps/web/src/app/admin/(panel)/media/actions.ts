"use server";
import { eq } from "drizzle-orm";
import { mediaReferences } from "@/lib/admin/usage";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { errorMessage, FormError, int, isRedirect, str } from "@/lib/admin/form";

export async function updateMedia(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  if (!id) fail("/admin/media/", "Missing id.");
  try {
    await getDb()
      .update(s.media)
      .set({ altText: str(fd, "altText"), caption: str(fd, "caption"), title: str(fd, "title"), credit: str(fd, "credit"), updatedAt: new Date() })
      .where(eq(s.media.id, id));
    await audit(user.id, "update", "media", id, "metadata");
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/media/${id}/`, errorMessage(e));
  }
  done(`/admin/media/${id}/`, "Saved.");
}

/**
 * Hides a file from the library and the site (soft delete). Refused while the file is used,
 * and for files imported from the old site, whose old web addresses must keep working.
 */
export async function deleteMedia(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  if (!id) fail("/admin/media/", "Missing id.");
  try {
    const db = getDb();
    const [m] = await db.select().from(s.media).where(eq(s.media.id, id));
    if (!m) throw new FormError("Not found.");
    // Drafts, text, published page snapshots and importer-found uses all block a delete:
    // the editor replaces the file (or removes it there) first.
    const refs = await mediaReferences(db, id);
    if (refs.length) {
      const n = refs.length;
      throw new FormError(`This file is still used in ${n} place${n === 1 ? "" : "s"} (listed under “Used in”). Replace it, or remove it there and publish, then delete.`);
    }
    if (m.source !== "manual") throw new FormError("Files from the old website are kept so their old addresses keep working. You can stop using them instead.");
    await db.update(s.media).set({ deletedAt: new Date(), isPublic: false }).where(eq(s.media.id, id));
    await audit(user.id, "delete", "media", id, m.r2Key);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/media/${id}/`, errorMessage(e));
  }
  done("/admin/media/", "File removed from the library.");
}

"use server";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { errorMessage, FormError, int, isRedirect, oneOf, req, str } from "@/lib/admin/form";

const STATUSES = ["draft", "published", "archived"] as const;

export async function saveDocument(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  try {
    if (!id) throw new FormError("Missing id.");
    const db = getDb();
    const [d] = await db.select().from(s.documents).where(eq(s.documents.id, id));
    if (!d) throw new FormError("Not found.");
    const status = oneOf(fd, "status", STATUSES, "draft");
    await db
      .update(s.documents)
      .set({
        title: req(fd, "title", "Title"),
        description: str(fd, "description"),
        category: str(fd, "category"),
        status,
        sort: int(fd, "sort") ?? 0,
        publishedAt: status === "published" ? (d.publishedAt ?? new Date()) : d.publishedAt,
        // Publishing a document the client had not yet approved counts as their decision (C6).
        reviewState: status === "published" && d.reviewState === "pending_client" ? "client_approved" : d.reviewState,
        updatedAt: new Date(),
      })
      .where(eq(s.documents.id, id));
    await audit(user.id, status === "published" ? "publish" : "update", "document", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/documents/", errorMessage(e));
  }
  done("/admin/documents/", "Saved.");
}

export async function deleteDocument(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  try {
    if (!id) throw new FormError("Missing id.");
    // Removes the document listing only; the PDF stays in the media library at its address.
    await getDb().delete(s.documents).where(eq(s.documents.id, id));
    await audit(user.id, "delete", "document", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/documents/", errorMessage(e));
  }
  done("/admin/documents/", "Document removed from the list. The PDF file is still in the media library.");
}

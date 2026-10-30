"use server";
import { eq } from "drizzle-orm";
import { POST_STATUSES } from "@gio/db/schema";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { sanitize } from "@/lib/sanitize";
import { audit, done, fail, hasRole, requireRole } from "@/lib/admin/guard";
import { errorMessage, FormError, int, isRedirect, istDate, oneOf, req, slugify, str } from "@/lib/admin/form";

const { posts, postCategories, revisions } = schema;

/** Create (id null) or update a post. Contributors can only save drafts or send for review. */
export async function savePost(id: number | null, fd: FormData) {
  const { user } = await requireRole("contributor");
  const back = id ? `/admin/posts/${id}/` : "/admin/posts/new/";
  const db = getDb();
  let postId = id;
  try {
    const title = req(fd, "title", "Title");
    const slug = slugify(str(fd, "slug") ?? title);
    if (!slug) throw new FormError("Slug is empty. Type one using letters or numbers.");
    let status = oneOf(fd, "status", POST_STATUSES, "draft");
    if (!hasRole(user, "editor") && status !== "draft" && status !== "review") status = "review";
    let publishedAt = istDate(fd, "publishedAt");
    if (status === "published" && !publishedAt) publishedAt = new Date();

    const values = {
      title,
      slug,
      excerpt: str(fd, "excerpt"),
      bodyHtml: sanitize(str(fd, "bodyHtml") ?? ""),
      status,
      publishedAt,
      featuredMediaId: int(fd, "featuredMediaId"),
      seoTitle: str(fd, "seoTitle"),
      seoDescription: str(fd, "seoDescription"),
      modifiedAt: new Date(),
      updatedAt: new Date(),
    };
    const categoryIds = fd.getAll("categories").map(Number).filter(Number.isInteger);

    if (id) {
      const [before] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!before || before.deletedAt) throw new FormError("This post no longer exists.");
      if (!hasRole(user, "editor") && before.status === "published") throw new FormError("Only editors can change a published post.");
      await db.insert(revisions).values({ entityType: "post", entityId: String(id), snapshotJson: JSON.stringify(before), userId: user.id });
      await db.update(posts).set(values).where(eq(posts.id, id));
    } else {
      const [row] = await db.insert(posts).values({ ...values, source: "manual" }).returning({ id: posts.id });
      postId = row.id;
    }
    await db.delete(postCategories).where(eq(postCategories.postId, postId!));
    if (categoryIds.length) await db.insert(postCategories).values(categoryIds.map((categoryId) => ({ postId: postId!, categoryId })));
    await audit(user.id, id ? "update" : "create", "post", postId!, `${title} (${status})`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(back, errorMessage(e));
  }
  done(`/admin/posts/${postId}/`, id ? "Post saved." : "Post created.");
}

/** Soft delete: the row stays (with its revisions) but disappears from the site and the admin lists. */
export async function deletePost(id: number) {
  const { user } = await requireRole("admin");
  await getDb().update(schema.posts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(schema.posts.id, id));
  await audit(user.id, "delete", "post", id);
  done("/admin/posts/", "Post moved to trash.");
}

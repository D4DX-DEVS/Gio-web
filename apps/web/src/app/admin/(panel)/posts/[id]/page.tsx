import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/admin/guard";
import { PageHeader } from "@/lib/admin/ui";
import { PostForm } from "../post-form";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: PageProps<"/admin/posts/[id]">) {
  const { user } = await requireRole("contributor");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt)))
    .limit(1);
  if (!post) notFound();
  const cats = await db.select({ id: schema.postCategories.categoryId }).from(schema.postCategories).where(eq(schema.postCategories.postId, id));
  return (
    <>
      <PageHeader
        title="Edit post"
        description={post.title}
        actions={
          <>
            <a href={`/admin/preview/post/${id}/`} target="_blank" className="btn btn-ghost">
              Preview ↗
            </a>
            {post.status === "published" ? (
              <a href={`/${encodeURIComponent(post.slug)}/`} target="_blank" className="btn btn-ghost">
                View on website ↗
              </a>
            ) : null}
          </>
        }
      />
      <PostForm user={user} post={post} categoryIds={cats.map((c) => c.id)} />
    </>
  );
}

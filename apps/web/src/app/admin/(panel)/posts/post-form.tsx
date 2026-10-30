import Link from "next/link";
import { asc } from "drizzle-orm";
import { POST_STATUSES } from "@gio/db/schema";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { encodePath } from "@/lib/content";
import type { AdminUser } from "@/lib/auth";
import { hasRole } from "@/lib/admin/guard";
import { toIstInput } from "@/lib/admin/form";
import { mediaPreviews } from "@/lib/admin/media-options";
import { ConfirmButton, MediaPicker, SubmitButton } from "@/lib/admin/client";
import { Card, Field } from "@/lib/admin/ui";
import { deletePost, savePost } from "./actions";

type Post = typeof schema.posts.$inferSelect;

export async function PostForm({ user, post, categoryIds = [] }: { user: AdminUser; post?: Post; categoryIds?: number[] }) {
  const db = getDb();
  const [categories, previews] = await Promise.all([db.select().from(schema.categories).orderBy(asc(schema.categories.name)), mediaPreviews(db, [post?.featuredMediaId])]);
  const statuses = hasRole(user, "editor") ? POST_STATUSES : (["draft", "review"] as const);
  const save = savePost.bind(null, post?.id ?? null);

  return (
    <form action={save} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card>
          <div className="space-y-4">
            <Field label="Title">
              <input name="title" required defaultValue={post?.title} className="field text-lg" />
            </Field>
            <Field label="Slug (web address)" hint="Leave empty to make one from the title. Changing the slug of a published post breaks old links.">
              <input name="slug" defaultValue={post?.slug} className="field font-mono text-sm" />
            </Field>
            <Field label="Excerpt" hint="Short summary shown on listing cards.">
              <textarea name="excerpt" rows={3} defaultValue={post?.excerpt ?? ""} className="field" />
            </Field>
            <Field label="Body (HTML)" hint="Paragraphs as <p>…</p>. Unsafe tags and scripts are removed when saving.">
              <textarea name="bodyHtml" rows={22} defaultValue={post?.bodyHtml ?? ""} className="field font-mono text-sm leading-relaxed" />
            </Field>
          </div>
        </Card>
        <Card title="Search engines">
          <div className="grid gap-4">
            <Field label="SEO title">
              <input name="seoTitle" defaultValue={post?.seoTitle ?? ""} className="field" />
            </Field>
            <Field label="SEO description">
              <textarea name="seoDescription" rows={2} defaultValue={post?.seoDescription ?? ""} className="field" />
            </Field>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Publish">
          <div className="space-y-4">
            <Field label="Status">
              <select name="status" defaultValue={post?.status ?? "draft"} className="field">
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Publish date (India time)" hint="Empty = now, when published.">
              <input type="datetime-local" name="publishedAt" defaultValue={toIstInput(post?.publishedAt)} className="field" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{post ? "Save changes" : "Create post"}</SubmitButton>
              {post?.status === "published" ? (
                <a href={`/${encodePath(post.slug)}/`} target="_blank" className="btn btn-ghost">
                  View ↗
                </a>
              ) : null}
            </div>
            {post && hasRole(user, "admin") ? (
              <div className="border-t border-line pt-4">
                <ConfirmButton formAction={deletePost.bind(null, post.id)} message="Move this post to the trash? It will disappear from the website.">
                  Delete post
                </ConfirmButton>
              </div>
            ) : null}
          </div>
        </Card>
        <Card title="Featured image">
          <MediaPicker
            name="featuredMediaId"
            defaultId={post?.featuredMediaId}
            preview={post?.featuredMediaId ? previews.get(post.featuredMediaId) : null}
            label="Image shown on cards and at the top"
          />
        </Card>
        <Card title="Categories">
          <div className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" name="categories" value={c.id} defaultChecked={categoryIds.includes(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </Card>
        {post ? (
          <p className="text-xs text-muted">
            Source: {post.source}
            {post.legacyWpId ? ` · WordPress #${post.legacyWpId}` : ""} · <Link href="/admin/posts/" className="underline">Back to list</Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}

import Link from "next/link";
import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { POST_STATUSES } from "@gio/db/schema";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { encodePath } from "@/lib/content";
import { requireRole } from "@/lib/admin/guard";
import { contains } from "@/lib/admin/sql";
import { fmtDate } from "@/lib/admin/form";
import { Badge, EmptyRow, PageHeader, Pagination, Table, pageParam, param } from "@/lib/admin/ui";

export const metadata = { title: "Posts" };
const PAGE_SIZE = 25;

export default async function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  await requireRole("contributor");
  const sp = await searchParams;
  const page = pageParam(sp);
  const q = param(sp, "q")?.trim();
  const status = POST_STATUSES.find((s) => s === param(sp, "status"));
  const p = schema.posts;
  const where = and(
    isNull(p.deletedAt),
    status ? eq(p.status, status) : undefined,
    q ? or(contains(p.title, q), contains(p.slug, q)) : undefined,
  );
  const db = getDb();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
        reviewState: p.reviewState,
        categories: sql<string | null>`(select group_concat(c.name, ', ') from post_categories pc join categories c on c.id = pc.category_id where pc.post_id = ${p.id})`,
      })
      .from(p)
      .where(where)
      .orderBy(desc(sql`coalesce(${p.publishedAt}, ${p.updatedAt})`), desc(p.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(p).where(where),
  ]);

  return (
    <>
      <PageHeader
        title="Posts"
        description="News, reports and articles. Published posts appear on the website at their own URL."
        actions={
          <Link href="/admin/posts/new/" className="btn btn-primary">
            + New post
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/posts/">
        <input name="q" defaultValue={q} placeholder="Search title or slug" className="field max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="field w-auto">
          <option value="">All statuses</option>
          {POST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost">Filter</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="max-w-md">
                  <Link href={`/admin/posts/${r.id}/`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                    {r.title || "(no title)"}
                  </Link>
                  <div className="truncate text-xs text-muted">/{r.slug}/</div>
                </td>
                <td className="text-muted">{r.categories ?? "—"}</td>
                <td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge value={r.status} />
                    {r.reviewState === "pending_client" ? <Badge value="pending_client" label="needs review" /> : null}
                  </div>
                </td>
                <td className="whitespace-nowrap text-muted">{fmtDate(r.publishedAt ?? r.updatedAt)}</td>
                <td className="whitespace-nowrap text-right">
                  {r.status === "published" ? (
                    <a href={`/${encodePath(r.slug)}/`} target="_blank" className="text-sm text-brand-700 hover:underline">
                      View ↗
                    </a>
                  ) : null}
                </td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No posts match.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination basePath="/admin/posts/" page={page} pageSize={PAGE_SIZE} total={n} params={{ q, status }} />
    </>
  );
}

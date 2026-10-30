import Link from "next/link";
import { asc, isNull, sql } from "drizzle-orm";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { encodePath } from "@/lib/content";
import { requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { Badge, PageHeader, Table } from "@/lib/admin/ui";

export const metadata = { title: "Pages" };

const TEMPLATE_LABEL: Record<string, string> = {
  sections: "Sections",
  leaders: "Leaders list",
  post_listing: "Post listing",
  contact: "Contact",
  embed: "Embed",
};

export default async function PagesPage() {
  await requireRole("contributor");
  const p = schema.pages;
  const rows = await getDb()
    .select({
      id: p.id,
      slug: p.slug,
      title: p.title,
      template: p.template,
      status: p.status,
      updatedAt: p.updatedAt,
      sectionCount: sql<number>`(select count(*) from sections s where s.page_id = ${p.id})`,
      publishedAt: sql<number | null>`(select published_at from published_layouts l where l.page_id = ${p.id} and l.is_current = 1)`,
    })
    .from(p)
    .where(isNull(p.deletedAt))
    .orderBy(sql`${p.slug} <> ''`, asc(p.title));

  return (
    <>
      <PageHeader title="Pages & homepage" description="The homepage and fixed pages. Section pages are edited as a draft and go live when you click Publish." />
      <Table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Type</th>
            <th>Status</th>
            <th>Last published</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/pages/${r.id}/`} className="font-medium text-ink hover:text-brand-700 hover:underline">
                  {r.slug === "" ? "Homepage" : r.title}
                </Link>
                <div className="text-xs text-muted">{r.slug === "" ? "/" : `/${r.slug}/`}</div>
              </td>
              <td className="text-muted">
                {TEMPLATE_LABEL[r.template] ?? r.template}
                {r.sectionCount ? ` · ${r.sectionCount} sections` : ""}
              </td>
              <td>
                <Badge value={r.status} />
              </td>
              <td className="whitespace-nowrap text-muted">{r.publishedAt ? fmtDate(r.publishedAt, true) : "—"}</td>
              <td className="whitespace-nowrap text-right">
                <a href={r.slug === "" ? "/" : `/${encodePath(r.slug)}/`} target="_blank" className="text-sm text-brand-700 hover:underline">
                  View ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-4 text-sm text-muted">
        Leader pages list the people from <Link href="/admin/leaders/" className="text-brand-700 underline">Leaders</Link>; post listing pages show{" "}
        <Link href="/admin/posts/" className="text-brand-700 underline">Posts</Link> from their category.
      </p>
    </>
  );
}

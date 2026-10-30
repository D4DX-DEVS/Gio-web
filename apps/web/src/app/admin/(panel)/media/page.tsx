import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { mediaUrl } from "@/lib/admin/media-options";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { contains } from "@/lib/admin/sql";
import { FileInput } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader, Pagination, pageParam, param } from "@/lib/admin/ui";

export const metadata: Metadata = { title: "Media library" };

const PAGE_SIZE = 48;
const FILTERS = [
  { key: "all", label: "All files" },
  { key: "images", label: "Images" },
  { key: "documents", label: "PDFs" },
  { key: "no-alt", label: "Images without alt text" },
  { key: "unused", label: "Not used anywhere" },
  { key: "new", label: "Uploaded here" },
] as const;

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireRole("contributor");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === param(sp, "filter"))?.key ?? "all";
  const q = param(sp, "q")?.trim();
  const page = pageParam(sp);
  const m = s.media;
  const db = getDb();
  // Selected in a field, or found by the importer (text inside HTML is checked on the file's own page).
  const usedIn = [
    [s.mediaUsage, s.mediaUsage.mediaId],
    [s.posts, s.posts.featuredMediaId],
    [s.events, s.events.featuredMediaId],
    [s.leaders, s.leaders.photoMediaId],
    [s.sectionItems, s.sectionItems.mediaId],
    [s.documents, s.documents.mediaId],
  ] as const;
  const used = sql`(${sql.join(
    usedIn.map(([t, c]) => sql`exists (select 1 from ${t} where ${c} = ${m.id})`),
    sql` or `,
  )})`;
  const where: SQL[] = [isNull(m.deletedAt), isNull(m.variantOfMediaId)];
  if (filter === "images") where.push(eq(m.kind, "image"));
  if (filter === "documents") where.push(eq(m.kind, "document"));
  if (filter === "no-alt") where.push(eq(m.kind, "image"), isNull(m.altText));
  if (filter === "unused") where.push(sql`not ${used}`);
  if (filter === "new") where.push(eq(m.source, "manual"));
  if (q) where.push(or(contains(m.originalFilename, q), contains(m.altText, q), contains(m.title, q))!);
  const cond = and(...where);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(m).where(cond).orderBy(desc(m.createdAt), desc(m.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(m).where(cond),
  ]);
  const ids = rows.map((r) => r.id);
  const usage = ids.length
    ? (
        await Promise.all(
          usedIn.map(([t, c]) =>
            db
              .select({ id: c, n: count() })
              .from(t)
              .where(inArray(c, ids))
              .groupBy(c),
          ),
        )
      ).flat()
    : [];
  const usedBy = new Map<number, number>();
  for (const u of usage) if (u.id !== null) usedBy.set(u.id, (usedBy.get(u.id) ?? 0) + u.n);

  return (
    <>
      <PageHeader title="Media library" description="Every image and PDF from the old site keeps its original web address. New uploads are stored in R2." />
      {hasRole(user, "editor") ? (
        <Card title="Upload" className="mb-6">
          <form action="/admin/media-upload/" method="post" encType="multipart/form-data" className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <Field label="Files" hint="JPEG, PNG, GIF, WebP up to 15 MB; PDF up to 50 MB.">
              <FileInput name="file" multiple required />
            </Field>
            <Field label="Used for">
              <select name="folder" className="field" defaultValue="images">
                <option value="images">Post / page image</option>
                <option value="banners">Banner / slide / poster</option>
                <option value="leaders">Leader photo</option>
                <option value="logos">Logo</option>
              </select>
            </Field>
            <Field label="Alt text (describe the image)" hint="Applies to every image in this upload. Edit each one later.">
              <input name="alt" className="field" />
            </Field>
            <button className="btn btn-primary">Upload</button>
          </form>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/media/?filter=${f.key}`} className={`btn ${filter === f.key ? "btn-primary" : "btn-ghost"}`}>
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/media/">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" className="field" placeholder="Search file name or alt" defaultValue={q ?? ""} />
          <button className="btn btn-ghost">Search</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {rows.map((r) => (
          <Link key={r.id} href={`/admin/media/${r.id}/`} className="group overflow-hidden rounded-xl border border-line bg-white shadow-sm hover:border-brand-300">
            <div className="flex aspect-square items-center justify-center bg-paper">
              {r.kind === "image" && r.fileStatus === "available" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(r.r2Key)} alt={r.altText ?? ""} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-brand-400">{r.kind === "document" ? "PDF" : r.fileStatus === "missing" ? "missing" : "file"}</span>
              )}
            </div>
            <div className="space-y-1 p-2 text-xs">
              <div className="truncate font-medium text-ink" title={r.originalFilename}>
                {r.originalFilename}
              </div>
              <div className="flex flex-wrap gap-1">
                {r.kind === "image" && !r.altText ? <Badge value="pending" label="no alt" /> : null}
                {usedBy.get(r.id) ? <Badge value="published" label={`used ${usedBy.get(r.id)}×`} /> : <Badge value="draft" label="unused" />}
                {r.fileStatus === "missing" ? <Badge value="rejected" label="file missing" /> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <Card>No files match.</Card> : null}
      <Pagination basePath="/admin/media/" page={page} pageSize={PAGE_SIZE} total={total} params={{ filter, q }} />
    </>
  );
}

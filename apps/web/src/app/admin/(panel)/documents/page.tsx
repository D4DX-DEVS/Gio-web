import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { mediaUrl } from "@/lib/admin/media-options";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { ConfirmButton, SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader } from "@/lib/admin/ui";
import { deleteDocument, saveDocument } from "./actions";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { user } = await requireRole("contributor");
  const rows = await getDb()
    .select({ d: s.documents, key: s.media.r2Key, size: s.media.byteSize, file: s.media.originalFilename })
    .from(s.documents)
    .innerJoin(s.media, eq(s.media.id, s.documents.mediaId))
    .orderBy(asc(s.documents.sort), asc(s.documents.id));
  const canEdit = hasRole(user, "editor");
  return (
    <>
      <PageHeader title="Documents (PDFs)" description="Published documents are listed on the website's Documents page. Drafts stay hidden, but their files keep their old addresses." />
      {canEdit ? (
        <Card title="Upload a PDF" className="mb-6">
          <form action="/admin/media-upload/" method="post" encType="multipart/form-data" className="grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
            <input type="hidden" name="back" value="/admin/documents/" />
            <Field label="PDF file" hint="Up to 50 MB. Starts as a draft.">
              <input type="file" name="file" required accept="application/pdf" className="field" />
            </Field>
            <Field label="Title">
              <input name="title" className="field" />
            </Field>
            <button className="btn btn-primary">Upload</button>
          </form>
        </Card>
      ) : null}
      <div className="space-y-4">
        {rows.map(({ d, key, size, file }) => (
          <Card key={d.id}>
            <form action={saveDocument} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_6rem] md:items-end">
              <input type="hidden" name="id" value={d.id} />
              <div className="md:col-span-4 flex flex-wrap items-center gap-2 text-sm">
                <a href={mediaUrl(key)} target="_blank" className="font-medium text-brand-700 hover:underline">
                  {file} ↗
                </a>
                <span className="text-muted">{(size / 1048576).toFixed(1)} MB</span>
                <Badge value={d.status} />
                {d.reviewState === "pending_client" ? <Badge value="pending_client" label="waiting for client (C6)" /> : null}
              </div>
              <Field label="Title">
                <input name="title" className="field" defaultValue={d.title} required disabled={!canEdit} />
              </Field>
              <Field label="Category">
                <input name="category" className="field" defaultValue={d.category ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Status">
                <select name="status" className="field" defaultValue={d.status} disabled={!canEdit}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Order">
                <input name="sort" type="number" className="field" defaultValue={d.sort} disabled={!canEdit} />
              </Field>
              <Field label="Description" className="md:col-span-4">
                <input name="description" className="field" defaultValue={d.description ?? ""} disabled={!canEdit} />
              </Field>
              {canEdit ? (
                <div className="flex gap-2 md:col-span-4">
                  <SubmitButton>Save</SubmitButton>
                  {hasRole(user, "admin") ? <ConfirmButton formAction={deleteDocument} message="Remove this document from the list? The PDF file stays in the media library." /> : null}
                </div>
              ) : null}
            </form>
          </Card>
        ))}
        {rows.length === 0 ? <Card>No documents yet.</Card> : null}
      </div>
    </>
  );
}

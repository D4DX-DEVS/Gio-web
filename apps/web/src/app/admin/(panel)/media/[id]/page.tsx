import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { mediaUrl } from "@/lib/admin/media-options";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { ConfirmButton, FileInput, SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader } from "@/lib/admin/ui";
import { mediaReferences } from "@/lib/admin/usage";
import { deleteMedia, updateMedia } from "../actions";

const HOW: Record<string, { value: string; label: string }> = {
  selected: { value: "scheduled", label: "selected" },
  text: { value: "pending", label: "in text" },
  live: { value: "published", label: "on website" },
  imported: { value: "draft", label: "imported" },
};

export const metadata: Metadata = { title: "Media file" };

export default async function MediaItem({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("contributor");
  const id = Number((await params).id);
  const db = getDb();
  const [m] = Number.isInteger(id) ? await db.select().from(s.media).where(eq(s.media.id, id)) : [];
  if (!m) notFound();
  const [usage, variants] = await Promise.all([
    mediaReferences(db, id),
    db.select({ id: s.media.id, key: s.media.r2Key, role: s.media.variantRole }).from(s.media).where(eq(s.media.variantOfMediaId, id)),
  ]);
  const url = mediaUrl(m.r2Key);
  const canEdit = hasRole(user, "editor");
  return (
    <>
      <PageHeader
        title={m.originalFilename}
        actions={
          <Link href="/admin/media/" className="btn btn-ghost">
            ← Library
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {m.kind === "image" && m.fileStatus === "available" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={m.altText ?? ""} className="max-h-[28rem] w-full rounded-lg bg-paper object-contain" />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg bg-paper text-3xl font-bold text-brand-400">{m.kind === "document" ? "PDF" : "file"}</div>
          )}
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Web address</dt>
            <dd className="break-all">
              <a href={url} target="_blank" className="text-brand-700 hover:underline">
                {url}
              </a>
            </dd>
            <dt className="text-muted">Type</dt>
            <dd>
              {m.mimeType}
              {m.width ? ` · ${m.width}×${m.height}` : ""} · {(m.byteSize / 1024).toFixed(0)} KB
            </dd>
            <dt className="text-muted">Status</dt>
            <dd>{m.fileStatus === "available" ? <Badge value="published" label="file in storage" /> : <Badge value="rejected" label="file missing" />}</dd>
            <dt className="text-muted">Source</dt>
            <dd>
              {m.source === "manual" ? "Uploaded here" : "Old website"}
              {m.legacyWpId ? ` (WordPress #${m.legacyWpId})` : ""} · {fmtDate(m.createdAt)}
            </dd>
            <dt className="text-muted">sha256</dt>
            <dd className="truncate font-mono text-xs">{m.sha256 || "—"}</dd>
            {variants.length ? (
              <>
                <dt className="text-muted">Other copies</dt>
                <dd className="space-y-0.5 text-xs">
                  {variants.map((v) => (
                    <div key={v.id} className="break-all">
                      {v.role?.replaceAll("_", " ")}: {v.key}
                    </div>
                  ))}
                </dd>
              </>
            ) : null}
          </dl>
        </Card>
        <div className="space-y-6">
          <Card title="Details">
            <form action={updateMedia} className="space-y-4">
              <input type="hidden" name="id" value={m.id} />
              {m.kind === "image" ? (
                <Field label="Alt text" hint="Describe what the image shows for people using screen readers. Leave empty if you are not sure; never guess names.">
                  <textarea name="altText" rows={2} className="field" defaultValue={m.altText ?? ""} disabled={!canEdit} />
                </Field>
              ) : null}
              <Field label="Title">
                <input name="title" className="field" defaultValue={m.title ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Caption">
                <input name="caption" className="field" defaultValue={m.caption ?? ""} disabled={!canEdit} />
              </Field>
              <Field label="Credit">
                <input name="credit" className="field" defaultValue={m.credit ?? ""} disabled={!canEdit} />
              </Field>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <SubmitButton>Save</SubmitButton>
                  {hasRole(user, "admin") && m.source === "manual" && !m.deletedAt ? (
                    usage.length ? (
                      <span className="self-center text-xs text-muted">Delete is available once nothing uses this file.</span>
                    ) : (
                      <ConfirmButton formAction={deleteMedia} message="Remove this file from the library and the website?" />
                    )
                  ) : null}
                </div>
              ) : null}
              {m.kind === "image" ? <p className="text-xs text-muted">Homepage sections show a new alt text after the page is published again.</p> : null}
            </form>
          </Card>
          {canEdit && m.fileStatus === "available" && !m.deletedAt ? (
            <Card title="Replace file">
              <form action="/admin/media-upload/" method="post" encType="multipart/form-data" className="space-y-3">
                <input type="hidden" name="replace" value={m.id} />
                <input type="hidden" name="folder" value={m.r2Key.split("/")[0] === "wp-content" ? "images" : m.r2Key.split("/")[0]} />
                <Field
                  label={m.kind === "image" ? "New image" : "New PDF"}
                  hint="Uploads a new file and selects it everywhere this one is selected. The old file stays at its old address, so old links keep working. Text that embeds the old file is not changed."
                >
                  <FileInput name="file" required accept={m.kind === "image" ? "image" : "pdf"} />
                </Field>
                <SubmitButton className="btn btn-ghost">Upload and replace</SubmitButton>
              </form>
            </Card>
          ) : null}
          <Card title={`Used in ${usage.length} place${usage.length === 1 ? "" : "s"}`}>
            {usage.length ? (
              <ul className="space-y-1.5 text-sm">
                {usage.map((u, k) => (
                  <li key={k} className="flex items-start justify-between gap-3">
                    {u.href ? (
                      <Link href={u.href} className="text-brand-700 hover:underline">
                        {u.label}
                      </Link>
                    ) : (
                      <span>{u.label}</span>
                    )}
                    <Badge value={HOW[u.how].value} label={HOW[u.how].label} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not used anywhere on the website.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

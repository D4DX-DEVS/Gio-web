import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { PAGE_STATUSES, SECTION_TYPES } from "@gio/db/schema";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { encodePath } from "@/lib/content";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { mediaPreviews } from "@/lib/admin/media-options";
import { ConfirmButton, MediaPicker, SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader } from "@/lib/admin/ui";
import { addItem, addSection, deleteItem, deleteSection, publishPage, saveItem, savePageMeta, saveSection } from "../actions";

export const metadata = { title: "Edit page" };

const TYPE_LABEL: Record<string, string> = {
  hero_carousel: "Hero slider",
  image_banner: "Image banner",
  image: "Image",
  rich_text: "Text",
  instagram_feed: "Instagram feed",
  poster_slider: "Poster slider",
  featured_video: "Featured video",
  logo_carousel: "Logo carousel",
  embed: "Embedded page",
  map: "Map",
  contact_form: "Contact form",
  document_list: "Document list",
  cta: "Call to action",
  latest_posts: "Latest posts",
  upcoming_events: "Upcoming events",
};
/** Section types whose content lives in items (slides, images, logos). */
const ITEM_TYPES = new Set(["hero_carousel", "image_banner", "image", "poster_slider", "logo_carousel", "cta"]);

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  const { user } = await requireRole("contributor");
  const pageId = Number((await params).id);
  if (!Number.isInteger(pageId)) notFound();
  const db = getDb();
  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), isNull(schema.pages.deletedAt)))
    .limit(1);
  if (!page) notFound();

  const secs = await db.select().from(schema.sections).where(eq(schema.sections.pageId, pageId)).orderBy(asc(schema.sections.sort), asc(schema.sections.id));
  const [items, [current]] = await Promise.all([
    secs.length
      ? db
          .select()
          .from(schema.sectionItems)
          .where(
            inArray(
              schema.sectionItems.sectionId,
              secs.map((s) => s.id),
            ),
          )
          .orderBy(asc(schema.sectionItems.sort), asc(schema.sectionItems.id))
      : Promise.resolve([]),
    db
      .select({ publishedAt: schema.publishedLayouts.publishedAt })
      .from(schema.publishedLayouts)
      .where(and(eq(schema.publishedLayouts.pageId, pageId), eq(schema.publishedLayouts.isCurrent, true)))
      .limit(1),
  ]);
  const previews = await mediaPreviews(
    db,
    items.map((i) => i.mediaId),
  );
  const lastDraftChange = Math.max(0, ...secs.map((s) => s.updatedAt.getTime()), ...items.map((i) => i.updatedAt.getTime()));
  const unpublished = !current || lastDraftChange > current.publishedAt.getTime();
  const canEdit = hasRole(user, "editor");
  const canDelete = hasRole(user, "admin");
  const isHome = page.slug === "";
  const publicUrl = isHome ? "/" : `/${encodePath(page.slug)}/`;

  return (
    <>
      <PageHeader
        title={isHome ? "Homepage" : page.title}
        description={
          <>
            {isHome ? "/" : `/${page.slug}/`} · template: {page.template} ·{" "}
            <Link href="/admin/pages/" className="underline">
              all pages
            </Link>
          </>
        }
        actions={
          <>
            {secs.length ? (
              <a href={`/admin/preview/page/${pageId}/`} target="_blank" className="btn btn-ghost">
                Preview draft ↗
              </a>
            ) : null}
            <a href={publicUrl} target="_blank" className="btn btn-ghost">
              View on website ↗
            </a>
            {canEdit && secs.length ? (
              <form action={publishPage.bind(null, pageId)}>
                <SubmitButton>Publish sections</SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      {secs.length ? (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm ring-1 ${unpublished ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-green-50 text-green-800 ring-green-200"}`}>
          {current
            ? unpublished
              ? `The draft has changes made after the last publish (${fmtDate(current.publishedAt, true)}). Click “Publish sections” to put them on the website.`
              : `The website shows the latest draft (published ${fmtDate(current.publishedAt, true)}).`
            : "These sections have never been published. The website shows nothing for them until you publish."}
        </div>
      ) : null}

      <Card title="Page details" className="mb-6">
        <form action={savePageMeta.bind(null, pageId)} className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <input name="title" required defaultValue={page.title} className="field" disabled={!canEdit} />
          </Field>
          <Field label="Slug" hint={isHome ? "The homepage is always /." : "Changing it breaks links to the old address."}>
            <input name="slug" defaultValue={page.slug} className="field font-mono text-sm" disabled={!canEdit || isHome} required={!isHome} />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={page.status} className="field" disabled={!canEdit}>
              {PAGE_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="SEO title">
            <input name="seoTitle" defaultValue={page.seoTitle ?? ""} className="field" disabled={!canEdit} />
          </Field>
          <Field label="SEO description" className="md:col-span-2">
            <textarea name="seoDescription" rows={2} defaultValue={page.seoDescription ?? ""} className="field" disabled={!canEdit} />
          </Field>
          {canEdit ? (
            <div>
              <SubmitButton>Save details</SubmitButton>
            </div>
          ) : null}
        </form>
      </Card>

      {page.template !== "sections" && !secs.length ? (
        <Card className="mb-6">
          <p className="text-sm text-muted">
            This page is built from {page.template === "leaders" ? "the leaders list" : page.template === "post_listing" ? "posts in its category" : "its template"}, not from
            sections. Edit that content in its own menu.
          </p>
        </Card>
      ) : null}

      <div className="space-y-6">
        {secs.map((s) => {
          const data = JSON.parse(s.dataJson) as Record<string, unknown>;
          const secItems = items.filter((i) => i.sectionId === s.id);
          return (
            <section key={s.id} id={`section-${s.id}`} className="scroll-mt-6 rounded-xl border border-line bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brand-900">{TYPE_LABEL[s.type] ?? s.type}</span>
                  {s.title ? <span className="text-sm text-muted">· {s.title}</span> : null}
                  {!s.isVisible ? <Badge value="hidden" /> : null}
                  {s.reviewState === "pending_client" ? <Badge value="pending_client" label="needs review" /> : null}
                </div>
                <span className="text-xs text-muted">
                  #{s.id} · order {s.sort}
                </span>
              </header>

              <form action={saveSection.bind(null, pageId, s.id)} className="grid gap-4 p-5 md:grid-cols-[1fr_8rem_8rem]">
                <Field label="Heading (optional)">
                  <input name="title" defaultValue={s.title ?? ""} className="field" disabled={!canEdit} />
                </Field>
                <Field label="Order" hint="Lower first">
                  <input name="sort" type="number" defaultValue={s.sort} className="field" disabled={!canEdit} />
                </Field>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input type="checkbox" name="isVisible" defaultChecked={s.isVisible} disabled={!canEdit} /> Visible
                </label>
                {s.type === "rich_text" ? (
                  <Field label="Text (HTML)" className="md:col-span-3" hint="Paragraphs as <p>…</p>. Malayalam is fine.">
                    <textarea name="html" rows={10} defaultValue={String(data.html ?? "")} className="field font-mono text-sm leading-relaxed" disabled={!canEdit} />
                  </Field>
                ) : (
                  <Field label="Settings (JSON)" className="md:col-span-3" hint="Advanced. For example autoplay, interval, video id or embed address.">
                    <textarea name="dataJson" rows={Math.min(8, Math.max(2, JSON.stringify(data, null, 2).split("\n").length))} defaultValue={JSON.stringify(data, null, 2)} className="field font-mono text-xs" disabled={!canEdit} />
                  </Field>
                )}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2 md:col-span-3">
                    <SubmitButton>Save section</SubmitButton>
                    {canDelete ? (
                      <ConfirmButton formAction={deleteSection.bind(null, pageId, s.id)} message="Delete this section and all its items from the draft?">
                        Delete section
                      </ConfirmButton>
                    ) : null}
                  </div>
                ) : null}
              </form>

              {secItems.length || ITEM_TYPES.has(s.type) ? (
                <div className="border-t border-line bg-paper/50 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-ink">Items ({secItems.length})</h3>
                  <div className="space-y-3">
                    {secItems.map((it) => (
                      <form key={it.id} action={saveItem.bind(null, pageId, it.id)} className={`grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[13rem_1fr_1fr] ${it.isVisible ? "border-line" : "border-dashed border-slate-300 opacity-80"}`}>
                        <MediaPicker name="mediaId" defaultId={it.mediaId} preview={it.mediaId ? previews.get(it.mediaId) : null} />
                        <div className="space-y-3">
                          <Field label="Heading">
                            <input name="heading" defaultValue={it.heading ?? ""} className="field" />
                          </Field>
                          <Field label="Text">
                            <textarea name="body" rows={2} defaultValue={it.body ?? ""} className="field" />
                          </Field>
                          <Field label="Image description (alt text)">
                            <input name="altText" defaultValue={it.altText ?? ""} className="field" />
                          </Field>
                        </div>
                        <div className="space-y-3">
                          <Field label="Link">
                            <input name="linkUrl" defaultValue={it.linkUrl ?? ""} className="field" placeholder="/about-us/ or https://…" />
                          </Field>
                          <Field label="Link label">
                            <input name="linkLabel" defaultValue={it.linkLabel ?? ""} className="field" />
                          </Field>
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <label className="flex items-center gap-1.5">
                              Order <input name="sort" type="number" defaultValue={it.sort} className="field w-20 py-1" />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" name="isVisible" defaultChecked={it.isVisible} /> Visible
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" name="openInNewTab" defaultChecked={it.openInNewTab} /> New tab
                            </label>
                          </div>
                          {canEdit ? (
                            <div className="flex gap-2">
                              <SubmitButton className="btn btn-primary py-1.5">Save item</SubmitButton>
                              {canDelete ? (
                                <ConfirmButton className="btn btn-danger py-1.5" formAction={deleteItem.bind(null, pageId, it.id)} message="Delete this item from the draft?">
                                  Delete
                                </ConfirmButton>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </form>
                    ))}
                  </div>
                  {canEdit ? (
                    <form action={addItem.bind(null, pageId, s.id)} className="mt-3">
                      <SubmitButton className="btn btn-ghost">+ Add item</SubmitButton>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {canEdit && (page.template === "sections" || secs.length) ? (
        <Card title="Add a section" className="mt-6">
          <form action={addSection.bind(null, pageId)} className="flex flex-wrap items-end gap-3">
            <Field label="Type">
              <select name="type" className="field" defaultValue="rich_text">
                {SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Heading (optional)">
              <input name="title" className="field" />
            </Field>
            <SubmitButton>Add section</SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}

// Focused homepage screens: banners, campaign posters, videos and initiative logos.
// They edit the same draft rows as the page editor (sections, section_items) and publish
// through publishPageLayout, so the website changes only when someone clicks Publish.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { SectionType } from "@gio/db/schema";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { youtubeId } from "@/lib/youtube";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { mediaPreviews } from "@/lib/admin/media-options";
import { ConfirmButton, MediaPicker, SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader } from "@/lib/admin/ui";
import { addItem, addSection, deleteItem, moveItem, publishPage, saveItem, saveSectionOptions } from "../../pages/actions";
import { VideoField } from "../video-field";

interface Kind {
  title: string;
  description: string;
  types: SectionType[];
  folder: string;
  noun: string;
  /** Tailwind aspect class for the preview tile. */
  aspect: string;
  fit: "cover" | "contain";
}

const KINDS: Record<string, Kind> = {
  banners: {
    title: "Homepage banners",
    description: "The large slides at the top of the homepage and the wide banner under them.",
    types: ["hero_carousel", "image_banner"],
    folder: "banners",
    noun: "banner",
    aspect: "aspect-[16/7]",
    fit: "cover",
  },
  posters: {
    title: "Campaign posters",
    description: "The “Campaigns & announcements” poster row and the single feature posters on the homepage.",
    types: ["poster_slider", "image"],
    folder: "banners",
    noun: "poster",
    aspect: "aspect-[4/5]",
    fit: "cover",
  },
  videos: {
    title: "Videos",
    description: "YouTube videos shown in the homepage “Watch” block. Videos stay on YouTube; only the link is stored.",
    types: ["featured_video"],
    folder: "images",
    noun: "video",
    aspect: "aspect-video",
    fit: "cover",
  },
  initiatives: {
    title: "Initiative logos",
    description: "The scrolling “Our initiatives” logo row near the bottom of the homepage.",
    types: ["logo_carousel"],
    folder: "logos",
    noun: "logo",
    aspect: "aspect-[2/1]",
    fit: "contain",
  },
};

const SECTION_LABEL: Partial<Record<SectionType, string>> = {
  hero_carousel: "Top slider",
  image_banner: "Wide banner",
  poster_slider: "Poster row",
  image: "Feature poster",
  featured_video: "Watch (videos)",
  logo_carousel: "Logo row",
};

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  return { title: KINDS[(await params).kind]?.title ?? "Homepage" };
}

export default async function HomepageKind({ params }: { params: Promise<{ kind: string }> }) {
  const { user } = await requireRole("contributor");
  const key = (await params).kind;
  const kind = KINDS[key];
  if (!kind) notFound();
  const db = getDb();
  const [home] = await db.select().from(s.pages).where(and(eq(s.pages.slug, ""), isNull(s.pages.deletedAt))).limit(1);
  if (!home) {
    return (
      <>
        <PageHeader title={kind.title} />
        <Card>There is no homepage in the database yet. Run the importer first.</Card>
      </>
    );
  }
  const pageId = home.id;
  const back = `/admin/homepage/${key}/`;
  const canEdit = hasRole(user, "editor");
  const canDelete = hasRole(user, "admin");

  const [allSecs, [current]] = await Promise.all([
    db.select({ id: s.sections.id, type: s.sections.type, updatedAt: s.sections.updatedAt }).from(s.sections).where(eq(s.sections.pageId, pageId)),
    db
      .select({ publishedAt: s.publishedLayouts.publishedAt })
      .from(s.publishedLayouts)
      .where(and(eq(s.publishedLayouts.pageId, pageId), eq(s.publishedLayouts.isCurrent, true)))
      .limit(1),
  ]);
  const allItems = allSecs.length
    ? await db
        .select()
        .from(s.sectionItems)
        .where(inArray(s.sectionItems.sectionId, allSecs.map((x) => x.id)))
        .orderBy(asc(s.sectionItems.sort), asc(s.sectionItems.id))
    : [];
  const secs = (
    await db
      .select()
      .from(s.sections)
      .where(and(eq(s.sections.pageId, pageId), inArray(s.sections.type, kind.types)))
      .orderBy(asc(s.sections.sort), asc(s.sections.id))
  ).map((sec) => ({ ...sec, data: JSON.parse(sec.dataJson) as Record<string, unknown>, items: allItems.filter((i) => i.sectionId === sec.id) }));
  const previews = await mediaPreviews(db, secs.flatMap((x) => x.items.map((i) => i.mediaId)));
  const lastChange = Math.max(0, ...allSecs.map((x) => x.updatedAt.getTime()), ...allItems.map((i) => i.updatedAt.getTime()));
  const unpublished = !current || lastChange > current.publishedAt.getTime();
  const publish = publishPage.bind(null, pageId);

  return (
    <>
      <PageHeader
        title={kind.title}
        description={kind.description}
        actions={
          <>
            <Link href={`/admin/preview/page/${pageId}/`} target="_blank" className="btn btn-ghost">
              Preview draft ↗
            </Link>
            <a href="/" target="_blank" className="btn btn-ghost">
              View website ↗
            </a>
            {canEdit ? (
              <form action={publish}>
                <input type="hidden" name="back" value={back} />
                <SubmitButton>Publish homepage</SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className={`mb-6 rounded-lg px-4 py-3 text-sm ring-1 ${unpublished ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-green-50 text-green-800 ring-green-200"}`}>
        {current
          ? unpublished
            ? `The homepage draft has changes made after the last publish (${fmtDate(current.publishedAt, true)}). Check them with “Preview draft”, then click “Publish homepage”. Publishing puts every homepage change live, including ones made on other screens.`
            : `The website shows the latest homepage draft (published ${fmtDate(current.publishedAt, true)}).`
          : "The homepage has never been published. The website shows nothing for it until you publish."}
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {Object.entries(KINDS).map(([k, v]) => (
          <Link key={k} href={`/admin/homepage/${k}/`} className={`btn ${k === key ? "btn-primary" : "btn-ghost"}`}>
            {v.title}
          </Link>
        ))}
        <Link href={`/admin/pages/${pageId}/`} className="btn btn-ghost">
          All homepage sections
        </Link>
      </nav>

      {!secs.length ? (
        <Card>
          <p className="text-sm text-muted">The homepage has no {SECTION_LABEL[kind.types[0]]?.toLowerCase()} section yet.</p>
          {canEdit ? (
            <form action={addSection.bind(null, pageId)} className="mt-3">
              <input type="hidden" name="type" value={kind.types[0]} />
              <SubmitButton className="btn btn-ghost">Add a {SECTION_LABEL[kind.types[0]]?.toLowerCase()} section</SubmitButton>
            </form>
          ) : null}
        </Card>
      ) : null}

      <div className="space-y-8">
        {secs.map((sec) => {
          const legacyVideo = sec.type === "featured_video" ? youtubeId(String(sec.data.youtubeId ?? "")) : null;
          const visibleItems = sec.items.filter((i) => i.isVisible);
          return (
            <section key={sec.id} id={`section-${sec.id}`} className="scroll-mt-6 rounded-xl border border-line bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-brand-900">{SECTION_LABEL[sec.type] ?? sec.type}</h2>
                  {sec.title ? <span className="text-sm text-muted">· {sec.title}</span> : null}
                  {!sec.isVisible ? <Badge value="hidden" /> : null}
                </div>
                <span className="text-xs text-muted">
                  {visibleItems.length} shown · {sec.items.length - visibleItems.length} hidden
                </span>
              </header>

              {canEdit ? (
                <form action={saveSectionOptions.bind(null, pageId, sec.id)} className="flex flex-wrap items-end gap-4 border-b border-line bg-paper/50 px-5 py-4">
                  <input type="hidden" name="back" value={`${back}#section-${sec.id}`} />
                  <Field label="Heading on the website" hint="Leave empty for the default." className="min-w-[14rem] flex-1">
                    <input name="title" defaultValue={sec.title ?? ""} className="field" />
                  </Field>
                  {sec.type === "hero_carousel" ? (
                    <Field label="Seconds per slide">
                      <input name="intervalSeconds" type="number" min={2} max={30} step={0.5} defaultValue={Number(sec.data.intervalMs ?? 5000) / 1000} className="field w-28" />
                    </Field>
                  ) : null}
                  {sec.type === "featured_video" ? (
                    <>
                      <Field label="Videos shown">
                        <input name="maxCards" type="number" min={1} max={12} defaultValue={Number(sec.data.maxCards ?? 6)} className="field w-24" />
                      </Field>
                      <label className="flex items-center gap-2 pb-2 text-sm">
                        <input type="checkbox" name="showLatest" defaultChecked={sec.data.showLatest !== false} /> Fill free places with the channel&apos;s newest uploads
                      </label>
                    </>
                  ) : null}
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" name="isVisible" defaultChecked={sec.isVisible} /> Show this block
                  </label>
                  <SubmitButton className="btn btn-ghost">Save block</SubmitButton>
                </form>
              ) : null}

              {legacyVideo && !sec.items.length ? (
                <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${legacyVideo}/mqdefault.jpg`} alt="" className="h-16 w-28 rounded object-cover" />
                  <p className="min-w-0 flex-1 text-muted">
                    The website shows the video chosen on the old site (<a className="underline" href={`https://www.youtube.com/watch?v=${legacyVideo}`} target="_blank" rel="noopener noreferrer">{legacyVideo}</a>) until you add videos here.
                  </p>
                  {canEdit ? (
                    <form action={addItem.bind(null, pageId, sec.id)}>
                      <input type="hidden" name="back" value={`${back}#section-${sec.id}`} />
                      <input type="hidden" name="filled" value="1" />
                      <input type="hidden" name="isVisible" value="1" />
                      <input type="hidden" name="linkUrl" value={legacyVideo} />
                      <SubmitButton className="btn btn-ghost">Add it to the list</SubmitButton>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                {sec.items.map((it, k) => {
                  const vid = sec.type === "featured_video" ? youtubeId(it.linkUrl) : null;
                  const img = it.mediaId ? previews.get(it.mediaId) : undefined;
                  const itemBack = `${back}#item-${it.id}`;
                  return (
                    <form
                      key={it.id}
                      id={`item-${it.id}`}
                      action={saveItem.bind(null, pageId, it.id)}
                      className={`group flex scroll-mt-6 flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-md ${it.isVisible ? "border-line" : "border-dashed border-slate-300"}`}
                    >
                      <input type="hidden" name="back" value={itemBack} />
                      <input type="hidden" name="sort" value={it.sort} />
                      <div className={`relative ${kind.aspect} bg-paper`}>
                        {sec.type === "featured_video" ? (
                          vid ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-muted">No video link</span>
                          )
                        ) : img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.url} alt={it.altText ?? img.alt ?? ""} className={`h-full w-full ${kind.fit === "cover" ? "object-cover" : "object-contain p-4"}`} loading="lazy" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-muted">No image yet</span>
                        )}
                        <span className="absolute left-2 top-2 flex gap-1">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-brand-900 shadow">#{k + 1}</span>
                          {!it.isVisible ? <Badge value="hidden" /> : null}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        {/* Read-only for contributors: every control, including the picker, is disabled. */}
                        <fieldset disabled={!canEdit} className="contents">
                        {sec.type === "featured_video" ? (
                          <>
                            <VideoField defaultValue={it.linkUrl ?? ""} />
                            <Field label="Title" hint="Leave empty to use the title from YouTube.">
                              <input name="heading" defaultValue={it.heading ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                            <Field label="Description (optional)" hint="Kept with the video; the current video cards show the title only.">
                              <textarea name="body" rows={2} defaultValue={it.body ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                          </>
                        ) : (
                          <>
                            <MediaPicker name="mediaId" label={`${kind.noun[0].toUpperCase()}${kind.noun.slice(1)} image`} folder={kind.folder} defaultId={it.mediaId} preview={img} />
                            <Field label="Title (optional)">
                              <input name="heading" defaultValue={it.heading ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                            <Field label="Description (optional)" hint="Kept with the item; the current homepage design shows the image only.">
                              <textarea name="body" rows={2} defaultValue={it.body ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                            <Field label="Alt text" hint="What the image shows, for screen readers. Empty uses the library's alt text.">
                              <input name="altText" defaultValue={it.altText ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                            <Field label="Link (optional)" hint="Where a click goes: /a-page/ or https://…">
                              <input name="linkUrl" defaultValue={it.linkUrl ?? ""} className="field" disabled={!canEdit} />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="openInNewTab" defaultChecked={it.openInNewTab} disabled={!canEdit} /> Open link in a new tab
                            </label>
                          </>
                        )}
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input type="checkbox" name="isVisible" defaultChecked={it.isVisible} disabled={!canEdit} /> Show on the website
                        </label>
                        </fieldset>
                        {canEdit ? (
                          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                            <SubmitButton className="btn btn-primary py-1.5">Save</SubmitButton>
                            <SubmitButton className="btn btn-ghost px-2.5 py-1.5" formAction={moveItem.bind(null, pageId, it.id, -1)} disabled={k === 0} label="Move earlier">
                              ↑
                            </SubmitButton>
                            <SubmitButton className="btn btn-ghost px-2.5 py-1.5" formAction={moveItem.bind(null, pageId, it.id, 1)} disabled={k === sec.items.length - 1} label="Move later">
                              ↓
                            </SubmitButton>
                            {canDelete ? (
                              <ConfirmButton className="btn btn-danger ml-auto py-1.5" formAction={deleteItem.bind(null, pageId, it.id)} message={`Delete this ${kind.noun} from the homepage draft? The image stays in the media library.`}>
                                Delete
                              </ConfirmButton>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </form>
                  );
                })}
                {!sec.items.length ? <p className="text-sm text-muted sm:col-span-2 xl:col-span-3">No {kind.noun}s in this block yet.</p> : null}
              </div>

              {canEdit ? (
                <form action={addItem.bind(null, pageId, sec.id)} className="grid gap-4 border-t border-line bg-paper/50 p-5 md:grid-cols-2">
                  <input type="hidden" name="back" value={`${back}#section-${sec.id}`} />
                  <input type="hidden" name="filled" value="1" />
                  <h3 className="font-semibold text-brand-900 md:col-span-2">Add a {kind.noun}</h3>
                  {sec.type === "featured_video" ? (
                    <>
                      <VideoField />
                      <div className="space-y-3">
                        <Field label="Title" hint="Leave empty to use the title from YouTube.">
                          <input name="heading" className="field" />
                        </Field>
                        <Field label="Description (optional)" hint="Kept with the video; the current video cards show the title only.">
                          <textarea name="body" rows={2} className="field" />
                        </Field>
                      </div>
                    </>
                  ) : (
                    <>
                      <MediaPicker name="mediaId" label="Image (choose from the library or upload)" folder={kind.folder} />
                      <div className="space-y-3">
                        <Field label="Title (optional)">
                          <input name="heading" className="field" />
                        </Field>
                        <Field label="Alt text">
                          <input name="altText" className="field" />
                        </Field>
                        <Field label="Link (optional)">
                          <input name="linkUrl" className="field" placeholder="/a-page/ or https://…" />
                        </Field>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name="isVisible" defaultChecked /> Show on the website after publishing
                    </label>
                    <SubmitButton>Add {kind.noun}</SubmitButton>
                  </div>
                </form>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}

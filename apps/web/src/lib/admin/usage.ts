// Where a media file is used, and swapping it for another file everywhere it is selected.
// The media_usage table only holds what the importer found; files chosen in the admin are
// found from the referencing columns themselves, plus each page's published snapshot.
import { and, eq, isNull, or, type SQLWrapper } from "drizzle-orm";
import { schema as s, type Db } from "@gio/db";
import { mediaPublicPath } from "@gio/db/layout";
import { encodePath } from "@/lib/content";
import { containsExact } from "./sql";

export interface MediaRef {
  label: string;
  href: string | null;
  /** "selected": picked in a field (swapped on replace). "text": inside HTML (edit by hand). "live": a published page snapshot. */
  how: "selected" | "text" | "live" | "imported";
}

const pageHref = (id: number) => `/admin/pages/${id}/`;

export async function mediaReferences(db: Db, id: number): Promise<MediaRef[]> {
  const [m] = await db.select({ r2Key: s.media.r2Key }).from(s.media).where(eq(s.media.id, id));
  if (!m) return [];
  const path = mediaPublicPath(m.r2Key);
  const paths = [...new Set([path, encodePath(path)])];
  const inHtml = (col: SQLWrapper) => or(...paths.map((p) => containsExact(col, p)))!;
  // How buildPageLayout serialises the file inside a published snapshot.
  const keyJson = `"r2Key":${JSON.stringify(m.r2Key)}`;

  const [posts, ogPosts, textPosts, events, textEvents, leaders, docs, items, textSecs, live, settings, imported] = await Promise.all([
    db.select({ id: s.posts.id, title: s.posts.title }).from(s.posts).where(and(eq(s.posts.featuredMediaId, id), isNull(s.posts.deletedAt))),
    db.select({ id: s.posts.id, title: s.posts.title }).from(s.posts).where(and(eq(s.posts.ogMediaId, id), isNull(s.posts.deletedAt))),
    db.select({ id: s.posts.id, title: s.posts.title }).from(s.posts).where(and(inHtml(s.posts.bodyHtml), isNull(s.posts.deletedAt))),
    db.select({ id: s.events.id, title: s.events.title }).from(s.events).where(and(eq(s.events.featuredMediaId, id), isNull(s.events.deletedAt))),
    db.select({ id: s.events.id, title: s.events.title }).from(s.events).where(and(inHtml(s.events.descriptionHtml), isNull(s.events.deletedAt))),
    db.select({ id: s.leaders.id, name: s.leaders.name }).from(s.leaders).where(eq(s.leaders.photoMediaId, id)),
    db.select({ id: s.documents.id, title: s.documents.title }).from(s.documents).where(eq(s.documents.mediaId, id)),
    db
      .select({ id: s.sectionItems.id, sectionId: s.sections.id, type: s.sections.type, pageId: s.pages.id, page: s.pages.title, slug: s.pages.slug })
      .from(s.sectionItems)
      .innerJoin(s.sections, eq(s.sections.id, s.sectionItems.sectionId))
      .innerJoin(s.pages, eq(s.pages.id, s.sections.pageId))
      .where(eq(s.sectionItems.mediaId, id)),
    db
      .select({ sectionId: s.sections.id, pageId: s.pages.id, page: s.pages.title, slug: s.pages.slug })
      .from(s.sections)
      .innerJoin(s.pages, eq(s.pages.id, s.sections.pageId))
      .where(inHtml(s.sections.dataJson)),
    db
      .select({ pageId: s.pages.id, page: s.pages.title, slug: s.pages.slug })
      .from(s.publishedLayouts)
      .innerJoin(s.pages, eq(s.pages.id, s.publishedLayouts.pageId))
      .where(and(eq(s.publishedLayouts.isCurrent, true), containsExact(s.publishedLayouts.layoutJson, keyJson))),
    db.select({ key: s.siteSettings.key }).from(s.siteSettings).where(and(eq(s.siteSettings.key, "logo_media"), eq(s.siteSettings.valueJson, String(id)))),
    db.select().from(s.mediaUsage).where(eq(s.mediaUsage.mediaId, id)),
  ]);
  const pageName = (r: { page: string; slug: string }) => (r.slug === "" ? "Homepage" : r.page);
  const refs: MediaRef[] = [
    ...posts.map((p) => ({ label: `Post “${p.title}”: featured image`, href: `/admin/posts/${p.id}/`, how: "selected" as const })),
    ...ogPosts.map((p) => ({ label: `Post “${p.title}”: share image`, href: `/admin/posts/${p.id}/`, how: "selected" as const })),
    ...textPosts.map((p) => ({ label: `Post “${p.title}”: inside the text`, href: `/admin/posts/${p.id}/`, how: "text" as const })),
    ...events.map((e) => ({ label: `Event “${e.title}”: featured image`, href: `/admin/events/${e.id}/`, how: "selected" as const })),
    ...textEvents.map((e) => ({ label: `Event “${e.title}”: inside the description`, href: `/admin/events/${e.id}/`, how: "text" as const })),
    ...leaders.map((l) => ({ label: `Leader “${l.name}”: photo`, href: `/admin/leaders/${l.id}/`, how: "selected" as const })),
    ...docs.map((d) => ({ label: `Document “${d.title}”`, href: "/admin/documents/", how: "selected" as const })),
    ...items.map((i) => ({ label: `${pageName(i)}: ${i.type.replaceAll("_", " ")} item #${i.id} (draft)`, href: `${pageHref(i.pageId)}#section-${i.sectionId}`, how: "selected" as const })),
    ...textSecs.map((t) => ({ label: `${pageName(t)}: inside text section #${t.sectionId} (draft)`, href: `${pageHref(t.pageId)}#section-${t.sectionId}`, how: "text" as const })),
    ...live.map((l) => ({ label: `${pageName(l)}: published version on the website`, href: pageHref(l.pageId), how: "live" as const })),
    ...settings.map(() => ({ label: "Site settings: logo", href: "/admin/settings/", how: "selected" as const })),
    ...imported.map((u) => ({ label: `${u.entityType.replaceAll("_", " ")} #${u.entityId}: ${u.field.replaceAll("_", " ")} (found by the importer)`, href: null, how: "imported" as const })),
  ];
  return refs;
}

/**
 * Point every field that selects `oldId` at `newId`. Text that embeds the old file's address
 * is left alone (reported by mediaReferences as "text"). Returns the pages whose sections
 * changed: they need publishing before the website shows the new file.
 */
export async function replaceMediaEverywhere(db: Db, oldId: number, newId: number): Promise<{ pages: { id: number; title: string }[]; fields: number }> {
  const now = new Date();
  const changedItems = await db
    .select({ pageId: s.pages.id, title: s.pages.title, slug: s.pages.slug })
    .from(s.sectionItems)
    .innerJoin(s.sections, eq(s.sections.id, s.sectionItems.sectionId))
    .innerJoin(s.pages, eq(s.pages.id, s.sections.pageId))
    .where(eq(s.sectionItems.mediaId, oldId));
  const results = await db.batch([
    db.update(s.posts).set({ featuredMediaId: newId, updatedAt: now }).where(eq(s.posts.featuredMediaId, oldId)),
    db.update(s.posts).set({ ogMediaId: newId, updatedAt: now }).where(eq(s.posts.ogMediaId, oldId)),
    db.update(s.pages).set({ ogMediaId: newId, updatedAt: now }).where(eq(s.pages.ogMediaId, oldId)),
    db.update(s.events).set({ featuredMediaId: newId, updatedAt: now }).where(eq(s.events.featuredMediaId, oldId)),
    db.update(s.leaders).set({ photoMediaId: newId, updatedAt: now }).where(eq(s.leaders.photoMediaId, oldId)),
    db.update(s.sectionItems).set({ mediaId: newId, updatedAt: now }).where(eq(s.sectionItems.mediaId, oldId)),
    db.update(s.siteSettings).set({ valueJson: String(newId), updatedAt: now }).where(and(eq(s.siteSettings.key, "logo_media"), eq(s.siteSettings.valueJson, String(oldId)))),
  ]);
  const fields = results.reduce((n, r) => n + ((r as { meta?: { changes?: number } }).meta?.changes ?? 0), 0);
  const pages = new Map(changedItems.map((p) => [p.pageId, { id: p.pageId, title: p.slug === "" ? "Homepage" : p.title }]));
  return { pages: [...pages.values()], fields };
}

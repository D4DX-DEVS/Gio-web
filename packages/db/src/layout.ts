// Section pages are edited as draft rows (sections, section_items) and published as one JSON
// snapshot in published_layouts (05 §8.1). The public site reads only the current snapshot.
// The importer and the admin "Publish" action both use publishPageLayout, so they produce the same shape.
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "./index";
import { media, publishedLayouts, sectionItems, sections, type SectionType } from "./schema/content";

export interface LayoutMedia {
  id: number;
  /** Root-relative URL the site serves the file at. */
  url: string;
  r2Key: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
}

export interface LayoutItem {
  id: number;
  media: LayoutMedia | null;
  heading: string | null;
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  openInNewTab: boolean;
  /** Placement alt text, falling back to the media item's alt text. Null when neither exists. */
  altText: string | null;
}

export interface LayoutSection {
  id: number;
  type: SectionType;
  title: string | null;
  data: Record<string, unknown>;
  startsAt: number | null;
  endsAt: number | null;
  items: LayoutItem[];
}

export interface PageLayout {
  version: 1;
  pageId: number;
  sections: LayoutSection[];
}

/** Legacy WordPress files keep their old path; new uploads are served under /media/. */
export function mediaPublicPath(r2Key: string): string {
  return r2Key.startsWith("wp-content/uploads/") ? `/${r2Key}` : `/media/${r2Key}`;
}

/** Resolve the page's visible draft sections and items into a renderable layout. */
export async function buildPageLayout(db: Db, pageId: number): Promise<PageLayout> {
  const secs = await db
    .select()
    .from(sections)
    .where(and(eq(sections.pageId, pageId), eq(sections.isVisible, true)))
    .orderBy(asc(sections.sort), asc(sections.id));
  const items = secs.length
    ? await db
        .select()
        .from(sectionItems)
        .where(and(inArray(sectionItems.sectionId, secs.map((s) => s.id)), eq(sectionItems.isVisible, true)))
        .orderBy(asc(sectionItems.sort), asc(sectionItems.id))
    : [];
  const mediaIds = [...new Set(items.map((i) => i.mediaId).filter((x): x is number => x !== null))];
  const files = mediaIds.length ? await db.select().from(media).where(inArray(media.id, mediaIds)) : [];
  const byId = new Map(files.map((f) => [f.id, f]));

  return {
    version: 1,
    pageId,
    sections: secs.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      data: JSON.parse(s.dataJson) as Record<string, unknown>,
      startsAt: s.startsAt?.getTime() ?? null,
      endsAt: s.endsAt?.getTime() ?? null,
      items: items
        .filter((i) => i.sectionId === s.id)
        .map((i) => {
          const f = i.mediaId ? byId.get(i.mediaId) : undefined;
          const m: LayoutMedia | null =
            f && f.fileStatus === "available" && !f.deletedAt
              ? { id: f.id, url: mediaPublicPath(f.r2Key), r2Key: f.r2Key, mimeType: f.mimeType, width: f.width, height: f.height, altText: f.altText }
              : null;
          return {
            id: i.id,
            media: m,
            heading: i.heading,
            body: i.body,
            linkUrl: i.linkUrl,
            linkLabel: i.linkLabel,
            openInNewTab: i.openInNewTab,
            altText: i.altText ?? m?.altText ?? null,
          };
        }),
    })),
  };
}

/**
 * Snapshot the draft into published_layouts and make it current, atomically (one D1 batch).
 * Returns the new layout id.
 */
export async function publishPageLayout(db: Db, pageId: number, publishedBy: string): Promise<number> {
  const layout = await buildPageLayout(db, pageId);
  const [row] = await db
    .insert(publishedLayouts)
    .values({ pageId, layoutJson: JSON.stringify(layout), isCurrent: false, publishedBy, publishedAt: new Date() })
    .returning({ id: publishedLayouts.id });
  await db.batch([
    db.update(publishedLayouts).set({ isCurrent: false }).where(and(eq(publishedLayouts.pageId, pageId), eq(publishedLayouts.isCurrent, true))),
    db.update(publishedLayouts).set({ isCurrent: true }).where(eq(publishedLayouts.id, row.id)),
  ]);
  return row.id;
}

/** The layout the public site renders, or null if the page has never been published. */
export async function currentPageLayout(db: Db, pageId: number): Promise<PageLayout | null> {
  const [row] = await db
    .select({ layoutJson: publishedLayouts.layoutJson })
    .from(publishedLayouts)
    .where(and(eq(publishedLayouts.pageId, pageId), eq(publishedLayouts.isCurrent, true)))
    .limit(1);
  return row ? (JSON.parse(row.layoutJson) as PageLayout) : null;
}

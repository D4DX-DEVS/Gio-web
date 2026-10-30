"use server";
import { and, asc, eq, max } from "drizzle-orm";
import { PAGE_STATUSES, SECTION_TYPES, type SectionType } from "@gio/db/schema";
import { schema } from "@gio/db";
import { publishPageLayout } from "@gio/db/layout";
import { getDb } from "@/lib/db";
import { sanitize } from "@/lib/sanitize";
import { watchUrl, youtubeId } from "@/lib/youtube";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { backTo, bool, errorMessage, FormError, int, isRedirect, link, oneOf, req, slugify, str } from "@/lib/admin/form";

const { media, pages, sections, sectionItems } = schema;
const editPath = (pageId: number) => `/admin/pages/${pageId}/`;

/** Section types whose items show an image; a visible item there must have one. */
const IMAGE_ITEMS = new Set<SectionType>(["hero_carousel", "image_banner", "image", "poster_slider", "logo_carousel"]);

/** Run a write, turning errors into a flash message on the screen the editor came from. */
async function attempt(path: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(path, errorMessage(e));
  }
}

export async function savePageMeta(pageId: number, fd: FormData) {
  const { user } = await requireRole("editor");
  await attempt(editPath(pageId), async () => {
    const [page] = await getDb().select().from(pages).where(eq(pages.id, pageId)).limit(1);
    if (!page) throw new FormError("Page not found.");
    // The homepage keeps slug ''.
    const slug = page.slug === "" ? "" : slugify(req(fd, "slug", "Slug"));
    const status = oneOf(fd, "status", PAGE_STATUSES, page.status);
    await getDb()
      .update(pages)
      .set({
        title: req(fd, "title", "Title"),
        slug,
        status,
        publishedAt: status === "published" ? (page.publishedAt ?? new Date()) : page.publishedAt,
        seoTitle: str(fd, "seoTitle"),
        seoDescription: str(fd, "seoDescription"),
        updatedAt: new Date(),
      })
      .where(eq(pages.id, pageId));
    await audit(user.id, "update", "page", pageId, page.title);
  });
  done(editPath(pageId), "Page details saved.");
}

async function sectionInPage(pageId: number, sectionId: number) {
  const [sec] = await getDb().select().from(sections).where(and(eq(sections.id, sectionId), eq(sections.pageId, pageId))).limit(1);
  if (!sec) throw new FormError("Section not found.");
  return sec;
}

/** Section data is JSON; rich_text keeps its HTML in data.html and is edited as plain HTML. */
export async function saveSection(pageId: number, sectionId: number, fd: FormData) {
  const { user } = await requireRole("editor");
  const back = backTo(fd, `${editPath(pageId)}#section-${sectionId}`);
  await attempt(back, async () => {
    const sec = await sectionInPage(pageId, sectionId);
    let data: Record<string, unknown>;
    if (sec.type === "rich_text") {
      data = { ...(JSON.parse(sec.dataJson) as Record<string, unknown>), html: sanitize(str(fd, "html") ?? "") };
    } else {
      const raw = str(fd, "dataJson") ?? "{}";
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
        data = parsed as Record<string, unknown>;
      } catch {
        throw new FormError("Settings must be a valid JSON object, for example {\"autoplay\": true}.");
      }
    }
    await getDb()
      .update(sections)
      .set({ title: str(fd, "title"), isVisible: bool(fd, "isVisible"), sort: int(fd, "sort") ?? sec.sort, dataJson: JSON.stringify(data), updatedAt: new Date() })
      .where(eq(sections.id, sectionId));
    await audit(user.id, "update", "section", sectionId, `page ${pageId}, ${sec.type}`);
  });
  done(back, "Section saved. Click Publish to put it on the website.");
}

/**
 * Plain-form section options for the focused homepage screens (no JSON): heading, visibility,
 * and per type: slide interval (hero), card count and channel fill (videos).
 */
export async function saveSectionOptions(pageId: number, sectionId: number, fd: FormData) {
  const { user } = await requireRole("editor");
  const back = backTo(fd, `${editPath(pageId)}#section-${sectionId}`);
  await attempt(back, async () => {
    const sec = await sectionInPage(pageId, sectionId);
    const data = JSON.parse(sec.dataJson) as Record<string, unknown>;
    if (sec.type === "hero_carousel") {
      const secs = Number(str(fd, "intervalSeconds"));
      if (!Number.isFinite(secs) || secs < 2 || secs > 30) throw new FormError("Slide time must be between 2 and 30 seconds.");
      data.intervalMs = Math.round(secs * 1000);
    }
    if (sec.type === "featured_video") {
      const n = int(fd, "maxCards");
      if (n === null || n < 1 || n > 12) throw new FormError("Number of videos must be between 1 and 12.");
      data.maxCards = n;
      data.showLatest = bool(fd, "showLatest");
    }
    await getDb()
      .update(sections)
      .set({ title: str(fd, "title"), isVisible: bool(fd, "isVisible"), dataJson: JSON.stringify(data), updatedAt: new Date() })
      .where(eq(sections.id, sectionId));
    await audit(user.id, "update", "section", sectionId, `page ${pageId}, ${sec.type} options`);
  });
  done(back, "Saved. Click Publish to put it on the website.");
}

export async function addSection(pageId: number, fd: FormData) {
  const { user } = await requireRole("editor");
  let newId = 0;
  await attempt(editPath(pageId), async () => {
    const db = getDb();
    const type = oneOf(fd, "type", SECTION_TYPES, "rich_text");
    const [{ m }] = await db.select({ m: max(sections.sort) }).from(sections).where(eq(sections.pageId, pageId));
    const [row] = await db
      .insert(sections)
      .values({ pageId, type, title: str(fd, "title"), dataJson: type === "rich_text" ? JSON.stringify({ html: "" }) : "{}", sort: (m ?? 0) + 10, source: "manual" })
      .returning({ id: sections.id });
    newId = row.id;
    await audit(user.id, "create", "section", row.id, `page ${pageId}, ${type}`);
  });
  done(`${editPath(pageId)}#section-${newId}`, "Section added (draft).");
}

export async function deleteSection(pageId: number, sectionId: number) {
  const { user } = await requireRole("admin");
  await attempt(editPath(pageId), async () => {
    await getDb().delete(sections).where(and(eq(sections.id, sectionId), eq(sections.pageId, pageId)));
    await audit(user.id, "delete", "section", sectionId, `page ${pageId}`);
  });
  done(editPath(pageId), "Section deleted from the draft. Publish to update the website.");
}

async function itemInPage(pageId: number, itemId: number) {
  const [row] = await getDb()
    .select({ id: sectionItems.id, sectionId: sectionItems.sectionId, sort: sectionItems.sort, type: sections.type })
    .from(sectionItems)
    .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
    .where(and(eq(sectionItems.id, itemId), eq(sections.pageId, pageId)))
    .limit(1);
  if (!row) throw new FormError("Item not found.");
  return row;
}

/** Checked item fields from a form. Videos keep a canonical YouTube link; images must exist. */
async function itemValues(type: SectionType, fd: FormData) {
  const isVisible = bool(fd, "isVisible");
  let linkUrl: string | null;
  if (type === "featured_video") {
    const id = youtubeId(str(fd, "linkUrl"));
    if (!id) throw new FormError("Paste a YouTube video link, for example https://www.youtube.com/watch?v=… or https://youtu.be/…");
    linkUrl = watchUrl(id);
  } else {
    linkUrl = link(fd, "linkUrl");
  }
  const mediaId = type === "featured_video" ? null : int(fd, "mediaId");
  if (mediaId !== null) {
    const [m] = await getDb().select({ kind: media.kind, deletedAt: media.deletedAt, fileStatus: media.fileStatus }).from(media).where(eq(media.id, mediaId)).limit(1);
    if (!m || m.deletedAt || m.fileStatus !== "available") throw new FormError("The chosen image is no longer in the library. Choose another.");
    if (IMAGE_ITEMS.has(type) && m.kind !== "image") throw new FormError("Choose an image (not a PDF) here.");
  }
  if (isVisible && mediaId === null && IMAGE_ITEMS.has(type)) throw new FormError("Choose or upload an image before making this item visible.");
  return {
    mediaId,
    heading: str(fd, "heading"),
    body: str(fd, "body"),
    linkUrl,
    linkLabel: str(fd, "linkLabel"),
    altText: str(fd, "altText"),
    openInNewTab: bool(fd, "openInNewTab"),
    isVisible,
  };
}

export async function saveItem(pageId: number, itemId: number, fd: FormData) {
  const { user } = await requireRole("editor");
  let back = backTo(fd, editPath(pageId));
  await attempt(back, async () => {
    const item = await itemInPage(pageId, itemId);
    back = backTo(fd, `${editPath(pageId)}#section-${item.sectionId}`);
    const v = await itemValues(item.type, fd);
    await getDb()
      .update(sectionItems)
      .set({ ...v, sort: int(fd, "sort") ?? item.sort, updatedAt: new Date() })
      .where(eq(sectionItems.id, itemId));
    await audit(user.id, "update", "section_item", itemId, `page ${pageId}`);
  });
  done(back, "Item saved. Click Publish to put it on the website.");
}

/**
 * Adds an item at the end of a section. From the page editor (no fields) it starts empty and
 * hidden, so an empty slide never reaches the website; from the focused homepage screens the
 * form carries the item's fields and they are checked like a save.
 */
export async function addItem(pageId: number, sectionId: number, fd?: FormData) {
  const { user } = await requireRole("editor");
  const back = backTo(fd, `${editPath(pageId)}#section-${sectionId}`);
  const filled = fd ? str(fd, "filled") === "1" : false;
  await attempt(back, async () => {
    const db = getDb();
    const sec = await sectionInPage(pageId, sectionId);
    const [{ m }] = await db.select({ m: max(sectionItems.sort) }).from(sectionItems).where(eq(sectionItems.sectionId, sectionId));
    const values = filled && fd ? await itemValues(sec.type, fd) : { isVisible: false };
    const [row] = await db
      .insert(sectionItems)
      .values({ ...values, sectionId, sort: (m ?? 0) + 10, source: "manual" })
      .returning({ id: sectionItems.id });
    await audit(user.id, "create", "section_item", row.id, `page ${pageId}, ${sec.type}`);
  });
  done(back, filled ? "Added to the draft. Click Publish to put it on the website." : "Item added (hidden). Fill it in, tick Visible and save.");
}

/**
 * Swap an item with its neighbour (dir -1 = earlier, 1 = later). Only the two rows change, so
 * imported items elsewhere keep their updated_at (the importer reads it to detect admin edits).
 * Equal sort values cannot be swapped, so then the section is renumbered 10, 20, …
 */
export async function moveItem(pageId: number, itemId: number, dir: -1 | 1, fd?: FormData) {
  const { user } = await requireRole("editor");
  let back = backTo(fd, editPath(pageId));
  await attempt(back, async () => {
    const db = getDb();
    const item = await itemInPage(pageId, itemId);
    back = backTo(fd, `${editPath(pageId)}#section-${item.sectionId}`);
    const all = await db
      .select({ id: sectionItems.id, sort: sectionItems.sort })
      .from(sectionItems)
      .where(eq(sectionItems.sectionId, item.sectionId))
      .orderBy(asc(sectionItems.sort), asc(sectionItems.id));
    const i = all.findIndex((r) => r.id === itemId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    const [a, b] = [all[i], all[j]];
    const now = new Date();
    if (a.sort !== b.sort) {
      await db.batch([
        db.update(sectionItems).set({ sort: b.sort, updatedAt: now }).where(eq(sectionItems.id, a.id)),
        db.update(sectionItems).set({ sort: a.sort, updatedAt: now }).where(eq(sectionItems.id, b.id)),
      ]);
    } else {
      [all[i], all[j]] = [b, a];
      await db.batch(all.map((r, k) => db.update(sectionItems).set({ sort: (k + 1) * 10, updatedAt: now }).where(eq(sectionItems.id, r.id))) as [never, ...never[]]);
    }
    await audit(user.id, "reorder", "section_item", itemId, `page ${pageId}, ${dir < 0 ? "up" : "down"}`);
  });
  done(back, "Order changed. Click Publish to put it on the website.");
}

export async function deleteItem(pageId: number, itemId: number, fd?: FormData) {
  const { user } = await requireRole("admin");
  let back = backTo(fd, editPath(pageId));
  await attempt(back, async () => {
    const item = await itemInPage(pageId, itemId);
    back = backTo(fd, `${editPath(pageId)}#section-${item.sectionId}`);
    await getDb().delete(sectionItems).where(eq(sectionItems.id, itemId));
    await audit(user.id, "delete", "section_item", itemId, `page ${pageId}`);
  });
  done(back, "Deleted from the draft. Click Publish to remove it from the website.");
}

export async function publishPage(pageId: number, fd?: FormData) {
  const { user } = await requireRole("editor");
  const back = backTo(fd, editPath(pageId));
  await attempt(back, async () => {
    const layoutId = await publishPageLayout(getDb(), pageId, user.id);
    await audit(user.id, "publish", "page", pageId, `layout ${layoutId}`);
  });
  done(back, "Published. The website now shows these sections.");
}

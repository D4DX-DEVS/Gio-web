// Read-side queries for the public site. Only published, non-deleted rows are returned.
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "@gio/db";
import { currentPageLayout, mediaPublicPath } from "@gio/db/layout";
import { getDb } from "./db";

const {
  categories,
  documents,
  eventCategories,
  eventCategoryMap,
  events,
  leaderGroups,
  leaders,
  media,
  menuItems,
  menus,
  pages,
  postCategories,
  posts,
  postTags,
  siteSettings,
  tags,
  venues,
} = schema;

export type MediaRow = typeof media.$inferSelect;

export interface PublicMedia {
  id: number;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  mimeType: string;
}

export function toPublicMedia(m: MediaRow | undefined | null): PublicMedia | null {
  if (!m || m.fileStatus !== "available" || m.deletedAt || !m.isPublic) return null;
  return {
    id: m.id,
    url: encodePath(mediaPublicPath(m.r2Key)),
    width: m.width,
    height: m.height,
    alt: m.altText ?? "",
    mimeType: m.mimeType,
  };
}

/** Percent-encode each path segment (R2 keys are stored decoded, some contain spaces or Malayalam). */
export function encodePath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

async function mediaByIds(ids: (number | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!unique.length) return new Map<number, PublicMedia>();
  const rows = await getDb().select().from(media).where(inArray(media.id, unique));
  const map = new Map<number, PublicMedia>();
  for (const r of rows) {
    const pm = toPublicMedia(r);
    if (pm) map.set(r.id, pm);
  }
  return map;
}

export async function getMedia(id: number | null | undefined) {
  if (!id) return null;
  return (await mediaByIds([id])).get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Site settings and navigation
// ---------------------------------------------------------------------------

export interface SiteInfo {
  name: string;
  tagline: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo: PublicMedia | null;
}

export async function getSiteInfo(): Promise<SiteInfo> {
  const rows = await getDb().select().from(siteSettings);
  const v = (k: string) => {
    const r = rows.find((x) => x.key === k);
    if (!r) return null;
    try {
      return JSON.parse(r.valueJson) as unknown;
    } catch {
      return null;
    }
  };
  const logoId = v("logo_media");
  return {
    name: (v("site_name") as string) ?? "GIO Kerala",
    tagline: (v("tagline") as string) ?? "",
    phone: (v("phone") as string) ?? null,
    email: (v("email") as string) ?? null,
    address: (v("address") as string) ?? null,
    logo: typeof logoId === "number" ? await getMedia(logoId) : null,
  };
}

export interface NavItem {
  id: number;
  label: string;
  url: string | null;
  icon: string | null;
  newTab: boolean;
  children: NavItem[];
}

export async function getMenu(key: string): Promise<NavItem[]> {
  const db = getDb();
  const [menu] = await db.select().from(menus).where(eq(menus.key, key)).limit(1);
  if (!menu) return [];
  const rows = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.isVisible, true)))
    .orderBy(asc(menuItems.sort), asc(menuItems.id));
  const toItem = (r: (typeof rows)[number]): NavItem => ({
    id: r.id,
    label: r.label,
    url: r.url,
    icon: r.icon,
    newTab: r.openInNewTab,
    children: rows.filter((c) => c.parentId === r.id).map(toItem),
  });
  return rows.filter((r) => r.parentId === null).map(toItem);
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export type PageRow = typeof pages.$inferSelect;

export async function getPublishedPage(slug: string): Promise<PageRow | null> {
  const [p] = await getDb()
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.status, "published"), isNull(pages.deletedAt)))
    .limit(1);
  return p ?? null;
}

export async function getPageLayout(pageId: number) {
  return currentPageLayout(getDb(), pageId);
}

export function pageConfig(p: PageRow): Record<string, unknown> {
  if (!p.templateConfig) return {};
  try {
    return JSON.parse(p.templateConfig) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface PostCard {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  image: PublicMedia | null;
  categories: { slug: string; name: string }[];
}

const publishedPost = and(eq(posts.status, "published"), isNull(posts.deletedAt));

async function toCards(rows: (typeof posts.$inferSelect)[]): Promise<PostCard[]> {
  const db = getDb();
  const imgs = await mediaByIds(rows.map((r) => r.featuredMediaId));
  const ids = rows.map((r) => r.id);
  const cats = ids.length
    ? await db
        .select({ postId: postCategories.postId, slug: categories.slug, name: categories.name })
        .from(postCategories)
        .innerJoin(categories, eq(categories.id, postCategories.categoryId))
        .where(inArray(postCategories.postId, ids))
    : [];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt,
    image: r.featuredMediaId ? (imgs.get(r.featuredMediaId) ?? null) : null,
    categories: cats.filter((c) => c.postId === r.id).map(({ slug, name }) => ({ slug, name })),
  }));
}

export interface PostFilter {
  category?: string;
  tag?: string;
}

async function filterIds(f: PostFilter): Promise<number[] | null> {
  const db = getDb();
  if (f.category) {
    const rows = await db
      .select({ id: postCategories.postId })
      .from(postCategories)
      .innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .where(eq(categories.slug, f.category));
    return rows.map((r) => r.id);
  }
  if (f.tag) {
    const rows = await db
      .select({ id: postTags.postId })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(eq(tags.slug, f.tag));
    return rows.map((r) => r.id);
  }
  return null;
}

export async function listPosts(f: PostFilter, page: number, perPage: number) {
  const db = getDb();
  const ids = await filterIds(f);
  if (ids && !ids.length) return { items: [] as PostCard[], total: 0, pages: 0 };
  const where = ids ? and(publishedPost, inArray(posts.id, ids)) : publishedPost;
  const [{ n }] = await db.select({ n: count() }).from(posts).where(where);
  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { items: await toCards(rows), total: n, pages: Math.ceil(n / perPage) };
}

export async function latestPosts(limit: number, category?: string) {
  return (await listPosts({ category }, 1, limit)).items;
}

export async function getPublishedPost(slug: string) {
  const db = getDb();
  const [p] = await db.select().from(posts).where(and(publishedPost, eq(posts.slug, slug))).limit(1);
  if (!p) return null;
  const [card] = await toCards([p]);
  const postTagRows = await db
    .select({ slug: tags.slug, name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, p.id));
  return { post: p, card, tags: postTagRows };
}

export async function relatedPosts(postId: number, categorySlug: string | undefined, limit = 3) {
  const items = (await listPosts({ category: categorySlug }, 1, limit + 1)).items;
  return items.filter((i) => i.id !== postId).slice(0, limit);
}

export async function getCategory(slug: string) {
  const [c] = await getDb().select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return c ?? null;
}

export async function getTag(slug: string) {
  const [t] = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return t ?? null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventCard {
  id: number;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  image: PublicMedia | null;
  venue: string | null;
  /** Not yet finished at request time. */
  upcoming: boolean;
}

const publishedEvent = and(inArray(events.status, ["published", "scheduled"]), isNull(events.deletedAt));

export async function listEvents(opts: { upcomingOnly?: boolean; category?: string; limit?: number } = {}) {
  const db = getDb();
  const conds = [publishedEvent];
  if (opts.upcomingOnly) conds.push(sql`coalesce(${events.endsAt}, ${events.startsAt}) >= ${Date.now()}`);
  if (opts.category) {
    const rows = await db
      .select({ id: eventCategoryMap.eventId })
      .from(eventCategoryMap)
      .innerJoin(eventCategories, eq(eventCategories.id, eventCategoryMap.categoryId))
      .where(eq(eventCategories.slug, opts.category));
    if (!rows.length) return [];
    conds.push(inArray(events.id, rows.map((r) => r.id)));
  }
  const rows = await db
    .select({ e: events, venueName: venues.name, venueCity: venues.city })
    .from(events)
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(...conds))
    .orderBy(opts.upcomingOnly ? asc(events.startsAt) : desc(events.startsAt))
    .limit(opts.limit ?? 100);
  const imgs = await mediaByIds(rows.map((r) => r.e.featuredMediaId));
  return rows.map(
    ({ e, venueName, venueCity }): EventCard => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      image: e.featuredMediaId ? (imgs.get(e.featuredMediaId) ?? null) : null,
      venue: [venueName, venueCity].filter(Boolean).join(", ") || null,
      upcoming: (e.endsAt ?? e.startsAt).getTime() >= Date.now(),
    }),
  );
}

export async function getPublishedEvent(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ e: events, v: venues })
    .from(events)
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(publishedEvent, eq(events.slug, slug)))
    .limit(1);
  if (!row) return null;
  const image = await getMedia(row.e.featuredMediaId);
  const report = row.e.reportPostId
    ? (await db.select({ slug: posts.slug, title: posts.title }).from(posts).where(and(publishedPost, eq(posts.id, row.e.reportPostId))).limit(1))[0]
    : undefined;
  return { event: row.e, venue: row.v, image, report: report ?? null };
}

// ---------------------------------------------------------------------------
// Leaders
// ---------------------------------------------------------------------------

export interface LeaderCard {
  id: number;
  name: string;
  role: string | null;
  district: string | null;
  description: string | null;
  photo: PublicMedia | null;
  facebook: string | null;
  instagram: string | null;
}

export interface LeaderGroupView {
  id: number;
  heading: string | null;
  termLabel: string | null;
  leaders: LeaderCard[];
}

export async function getLeaderGroups(scope: "state" | "district" | "former"): Promise<LeaderGroupView[]> {
  const db = getDb();
  const groups = await db
    .select()
    .from(leaderGroups)
    .where(and(eq(leaderGroups.scope, scope), eq(leaderGroups.isVisible, true)))
    .orderBy(asc(leaderGroups.sort), asc(leaderGroups.id));
  if (!groups.length) return [];
  const rows = await db
    .select()
    .from(leaders)
    .where(and(inArray(leaders.groupId, groups.map((g) => g.id)), eq(leaders.isVisible, true)))
    .orderBy(asc(leaders.sort), asc(leaders.id));
  const imgs = await mediaByIds(rows.map((r) => r.photoMediaId));
  return groups.map((g) => ({
    id: g.id,
    heading: g.heading,
    termLabel: g.termLabel,
    leaders: rows
      .filter((r) => r.groupId === g.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        role: r.roleTitle,
        district: r.district,
        description: r.description,
        photo: r.photoMediaId ? (imgs.get(r.photoMediaId) ?? null) : null,
        // Social links flagged for client review (the same profile published for two people)
        // stay out of the public site until the client confirms them.
        facebook: r.reviewState === "pending_client" ? null : r.facebookUrl,
        instagram: r.reviewState === "pending_client" ? null : r.instagramUrl,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Documents, gallery, search
// ---------------------------------------------------------------------------

export async function listDocuments() {
  const db = getDb();
  const rows = await db
    .select({ d: documents, m: media })
    .from(documents)
    .innerJoin(media, eq(media.id, documents.mediaId))
    .where(and(eq(documents.status, "published"), isNull(media.deletedAt)))
    .orderBy(asc(documents.sort), desc(documents.publishedAt));
  return rows
    .map(({ d, m }) => ({ ...d, file: toPublicMedia(m), byteSize: m.byteSize }))
    .filter((d) => d.file !== null);
}

/** Featured images of published posts and events: the site's real photo collections. */
export async function galleryCollections() {
  const [postRows, eventRows] = await Promise.all([listPosts({}, 1, 100), listEvents({ limit: 100 })]);
  const collections = [
    ...postRows.items.filter((p) => p.image).map((p) => ({ href: `/${encodeURIComponent(p.slug)}/`, title: p.title, date: p.publishedAt, image: p.image! })),
    ...eventRows.filter((e) => e.image).map((e) => ({ href: `/event/${encodeURIComponent(e.slug)}/`, title: e.title, date: e.startsAt, image: e.image! })),
  ];
  return collections.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

/** True when the old site served this exact path and url_map.csv keeps it (verified same_path). */
export async function isKeptLegacyPath(decodedPath: string) {
  const [row] = await getDb()
    .select({ id: schema.legacyUrls.id })
    .from(schema.legacyUrls)
    .where(and(eq(schema.legacyUrls.oldPathDecoded, decodedPath), eq(schema.legacyUrls.action, "same_path"), eq(schema.legacyUrls.decisionStatus, "verified")))
    .limit(1);
  return Boolean(row);
}

export async function sitemapEntries() {
  const db = getDb();
  const [p, ps, ev] = await Promise.all([
    db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(and(eq(pages.status, "published"), isNull(pages.deletedAt), eq(pages.showInSitemap, true))),
    db.select({ slug: posts.slug, modifiedAt: posts.modifiedAt, publishedAt: posts.publishedAt }).from(posts).where(publishedPost),
    db.select({ slug: events.slug, updatedAt: events.updatedAt }).from(events).where(publishedEvent),
  ]);
  return { pages: p, posts: ps, events: ev };
}

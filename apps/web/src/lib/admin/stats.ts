// Dashboard figures that need more than a COUNT: what the published homepage shows,
// and how many photos the public gallery has. All read from the database, nothing estimated.
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { schema as s, type Db } from "@gio/db";
import { currentPageLayout } from "@gio/db/layout";
import { youtubeId } from "@/lib/youtube";

export interface HomepageCounts {
  published: boolean;
  banners: number;
  posters: number;
  videos: number;
  /** True when the videos block also fills places from the YouTube channel feed. */
  channelFill: boolean;
  logos: number;
}

/** Items the live homepage shows, per kind, from its current published snapshot. */
export async function homepageCounts(db: Db): Promise<HomepageCounts> {
  const [home] = await db.select({ id: s.pages.id }).from(s.pages).where(and(eq(s.pages.slug, ""), isNull(s.pages.deletedAt))).limit(1);
  const layout = home ? await currentPageLayout(db, home.id) : null;
  const out: HomepageCounts = { published: Boolean(layout), banners: 0, posters: 0, videos: 0, channelFill: false, logos: 0 };
  for (const sec of layout?.sections ?? []) {
    const withImage = sec.items.filter((i) => i.media).length;
    if (sec.type === "hero_carousel" || sec.type === "image_banner") out.banners += withImage;
    if (sec.type === "poster_slider" || sec.type === "image") out.posters += withImage;
    if (sec.type === "logo_carousel") out.logos += withImage;
    if (sec.type === "featured_video") {
      const chosen = sec.items.filter((i) => youtubeId(i.linkUrl)).length;
      out.videos += chosen || (youtubeId(String(sec.data.youtubeId ?? "")) ? 1 : 0);
      out.channelFill ||= sec.data.showLatest !== false;
    }
  }
  return out;
}

/** Photos on /gallery/: published posts and events whose featured image is available and public. */
export async function galleryCount(db: Db): Promise<number> {
  const visible = and(eq(s.media.fileStatus, "available"), eq(s.media.isPublic, true), isNull(s.media.deletedAt));
  const [[p], [e]] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.posts)
      .innerJoin(s.media, eq(s.media.id, s.posts.featuredMediaId))
      .where(and(eq(s.posts.status, "published"), isNull(s.posts.deletedAt), visible)),
    db
      .select({ n: count() })
      .from(s.events)
      .innerJoin(s.media, eq(s.media.id, s.events.featuredMediaId))
      .where(and(inArray(s.events.status, ["published", "scheduled"]), isNull(s.events.deletedAt), visible)),
  ]);
  return (p?.n ?? 0) + (e?.n ?? 0);
}

// The public /gallery/ page is built from the featured images of published posts and events
// (lib/content.ts galleryCollections). This screen shows the same set and links to where each
// photo is chosen, so editors manage the gallery from the post or event itself.
import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { mediaUrl } from "@/lib/admin/media-options";
import { Badge, Card, PageHeader } from "@/lib/admin/ui";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdmin() {
  await requireRole("contributor");
  const db = getDb();
  const [posts, events] = await Promise.all([
    db
      .select({ id: s.posts.id, title: s.posts.title, date: s.posts.publishedAt, mediaId: s.posts.featuredMediaId })
      .from(s.posts)
      .where(and(eq(s.posts.status, "published"), isNull(s.posts.deletedAt), isNotNull(s.posts.featuredMediaId)))
      .orderBy(desc(s.posts.publishedAt))
      .limit(100),
    db
      .select({ id: s.events.id, title: s.events.title, date: s.events.startsAt, mediaId: s.events.featuredMediaId })
      .from(s.events)
      .where(and(inArray(s.events.status, ["published", "scheduled"]), isNull(s.events.deletedAt), isNotNull(s.events.featuredMediaId)))
      .orderBy(desc(s.events.startsAt))
      .limit(100),
  ]);
  const tiles = [
    ...posts.map((p) => ({ ...p, kind: "post" as const, edit: `/admin/posts/${p.id}/` })),
    ...events.map((e) => ({ ...e, kind: "event" as const, edit: `/admin/events/${e.id}/` })),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const ids = [...new Set(tiles.map((t) => t.mediaId!))];
  const files = ids.length
    ? await db
        .select({ id: s.media.id, r2Key: s.media.r2Key, alt: s.media.altText })
        .from(s.media)
        .where(and(inArray(s.media.id, ids), eq(s.media.fileStatus, "available"), eq(s.media.isPublic, true), isNull(s.media.deletedAt)))
    : [];
  const previews = new Map(files.map((f) => [f.id, { url: mediaUrl(f.r2Key), alt: f.alt }]));
  // Same rule as the website: only files that exist and are public appear.
  const shown = tiles.filter((t) => t.mediaId && previews.has(t.mediaId));

  return (
    <>
      <PageHeader
        title="Gallery"
        description="The website's gallery shows the featured image of every published post and event, newest first. To add a photo, publish a post or event with a featured image; to remove one, change or remove that image."
        actions={
          <a href="/gallery/" target="_blank" className="btn btn-ghost">
            View gallery ↗
          </a>
        }
      />
      <Card className="mb-6">
        <p className="text-sm text-muted">
          {shown.length} photos on the website: {shown.filter((t) => t.kind === "post").length} from posts, {shown.filter((t) => t.kind === "event").length} from events.{" "}
          <Link href="/admin/posts/new/" className="font-semibold text-brand-700 hover:underline">
            + New post
          </Link>{" "}
          ·{" "}
          <Link href="/admin/events/new/" className="font-semibold text-brand-700 hover:underline">
            + New event
          </Link>
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((t) => {
          const img = previews.get(t.mediaId!)!;
          return (
            <Link key={`${t.kind}-${t.id}`} href={t.edit} className="group overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
              <div className="aspect-[4/3] overflow-hidden bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? ""} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <div className="space-y-1 p-3">
                <div className="line-clamp-2 text-sm font-medium text-ink">{t.title || "(no title)"}</div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{fmtDate(t.date)}</span>
                  <Badge value={t.kind === "post" ? "new" : "scheduled"} label={t.kind} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {!shown.length ? <Card>No published post or event has a featured image yet.</Card> : null}
    </>
  );
}

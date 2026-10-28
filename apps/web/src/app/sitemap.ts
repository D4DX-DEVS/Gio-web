import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/content";

const ORIGIN = "https://www.giokerala.org";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { pages, posts, events } = await sitemapEntries();
  return [
    ...pages.map((p) => ({ url: p.slug ? `${ORIGIN}/${encodeURIComponent(p.slug)}/` : `${ORIGIN}/`, lastModified: p.updatedAt })),
    ...posts.map((p) => ({ url: `${ORIGIN}/${encodeURIComponent(p.slug)}/`, lastModified: p.modifiedAt ?? p.publishedAt ?? undefined })),
    ...events.map((e) => ({ url: `${ORIGIN}/event/${encodeURIComponent(e.slug)}/`, lastModified: e.updatedAt })),
    { url: `${ORIGIN}/events/` },
    { url: `${ORIGIN}/gallery/` },
    { url: `${ORIGIN}/documents/` },
  ];
}

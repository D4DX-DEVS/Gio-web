import type { Metadata } from "next";
import { GalleryGrid } from "@/components/GalleryGrid";
import { Container, EmptyState, PageHero } from "@/components/ui";
import { galleryCollections } from "@/lib/content";
import { formatDate } from "@/lib/text";

export const metadata: Metadata = { title: "Gallery", description: "Photos from GIO Kerala programmes, campaigns and events." };

export default async function GalleryPage() {
  const items = await galleryCollections();
  return (
    <>
      <PageHero title="Gallery" eyebrow="Moments" subtitle="Photographs from GIO Kerala programmes, campaigns and events, as published with each story." crumbs={[{ href: "/gallery/", label: "Gallery" }]} />
      <Container className="py-10 sm:py-14">
        {items.length ? (
          <>
            <p className="mb-6 text-sm text-muted">
              {items.length} photo{items.length === 1 ? "" : "s"}. Select a photo to view it full size.
            </p>
            <GalleryGrid tiles={items.map((it) => ({ href: it.href, title: it.title, date: formatDate(it.date), image: it.image }))} />
          </>
        ) : (
          <EmptyState title="No photos published yet." />
        )}
      </Container>
    </>
  );
}

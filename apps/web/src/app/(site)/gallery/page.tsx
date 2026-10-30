import type { Metadata } from "next";
import { GalleryGrid } from "@/components/GalleryGrid";
import { Container, EmptyState, PageHero } from "@/components/ui";
import { galleryCollections } from "@/lib/content";
import { formatDate } from "@/lib/text";

export const metadata: Metadata = { title: "Gallery", description: "Photos from GIO Kerala programmes, campaigns and events." };

export default async function GalleryPage() {
  const items = await galleryCollections();
  // Dates are formatted here so the client lightbox shows exactly what the server rendered.
  const tiles = items.map((it) => ({ href: it.href, title: it.title, date: it.date ? formatDate(it.date) : "", image: it.image }));
  return (
    <>
      <PageHero title="Gallery" eyebrow="Moments" subtitle="Photographs from GIO Kerala programmes, campaigns and events, as published with each story." crumbs={[{ href: "/gallery/", label: "Gallery" }]} />
      <Container className="py-8 sm:py-10">{tiles.length ? <GalleryGrid tiles={tiles} /> : <EmptyState title="No photos published yet." />}</Container>
    </>
  );
}

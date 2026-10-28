import type { Metadata } from "next";
import Link from "next/link";
import { Img } from "@/components/Img";
import { Container, EmptyState, PageHero } from "@/components/ui";
import { galleryCollections } from "@/lib/content";
import { formatDate, langOf } from "@/lib/text";

export const metadata: Metadata = { title: "Gallery", description: "Photos from GIO Kerala programmes, campaigns and events." };

export default async function GalleryPage() {
  const items = await galleryCollections();
  return (
    <>
      <PageHero title="Gallery" eyebrow="Moments" subtitle="Photographs from GIO Kerala programmes, campaigns and events, as published with each story." crumbs={[{ href: "/gallery/", label: "Gallery" }]} />
      <Container className="py-14">
        {items.length ? (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className="group relative block break-inside-avoid overflow-hidden rounded-2xl shadow-sm ring-1 ring-line">
                <Img media={it.image} alt={it.title} className="h-auto w-full transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-900/90 via-brand-900/40 to-transparent p-4 pt-12 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <p lang={langOf(it.title)} className="font-display font-semibold leading-snug">
                    {it.title || "Untitled post"}
                  </p>
                  {it.date && <p className="text-xs text-brand-100">{formatDate(it.date)}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No photos published yet." />
        )}
      </Container>
    </>
  );
}

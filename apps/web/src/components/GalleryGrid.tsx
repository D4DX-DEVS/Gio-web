"use client";

import { useState } from "react";
import type { PublicMedia } from "@/lib/content";
import { langOf } from "@/lib/text";
import { Img } from "./Img";
import { Lightbox } from "./Lightbox";

export interface GalleryTile {
  href: string;
  title: string;
  /** Pre-formatted on the server, so client and server render the same text. */
  date: string;
  image: PublicMedia;
}

/**
 * Photo wall for the gallery page. Each photo opens full size in the lightbox, with a link to
 * the story or event it was published with. Without JavaScript the tile links to the image file.
 */
export function GalleryGrid({ tiles }: { tiles: GalleryTile[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const items = tiles.map((t) => ({
    src: t.image.url,
    alt: t.image.alt || t.title,
    width: t.image.width,
    height: t.image.height,
    caption: t.title || "Untitled post",
    meta: t.date || undefined,
    href: t.href,
    hrefLabel: t.href.startsWith("/event/") ? "View the event" : "Read the story",
  }));

  return (
    <>
      <ul className="columns-2 gap-3 sm:gap-5 lg:columns-3 [&>li]:mb-3 sm:[&>li]:mb-5">
        {tiles.map((t, i) => (
          <li key={t.href} className="break-inside-avoid" data-reveal>
            <a
              href={t.image.url}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                setIndex(i);
                setOpen(true);
              }}
              aria-label={`View photo: ${t.title || "Untitled post"}`}
              className="group relative block cursor-zoom-in overflow-hidden rounded-xl bg-brand-50 shadow-card ring-1 ring-line sm:rounded-2xl"
            >
              <Img media={t.image} alt={t.image.alt || t.title} className="zoom-media h-auto w-full" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-900/90 via-brand-900/45 to-transparent p-3 pt-10 text-left text-white transition duration-300 sm:translate-y-2 sm:p-4 sm:pt-12 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100">
                <span lang={langOf(t.title)} className="line-clamp-2 block font-display text-sm font-semibold leading-snug sm:text-base">
                  {t.title || "Untitled post"}
                </span>
                {t.date && <span className="mt-0.5 hidden text-xs text-brand-100 sm:block">{t.date}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <Lightbox items={items} index={index} open={open} onClose={() => setOpen(false)} onIndex={setIndex} />
    </>
  );
}

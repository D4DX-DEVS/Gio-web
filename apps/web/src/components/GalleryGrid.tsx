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

interface Props {
  tiles: GalleryTile[];
  /** "masonry" keeps each photo's shape (gallery page); "row" crops them to one even row of cards (homepage). */
  layout?: "masonry" | "row";
}

/** Tilts a card toward the mouse in 3D and moves its glare there (styles: .tilt-3d in globals.css). */
function tilt(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--rx", `${((0.5 - y) * 14).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${((x - 0.5) * 14).toFixed(2)}deg`);
  el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
}

function untilt(e: React.PointerEvent<HTMLElement>) {
  for (const p of ["--rx", "--ry", "--mx", "--my"]) e.currentTarget.style.removeProperty(p);
}

/**
 * Photo wall for the gallery page and the homepage. Each photo tilts toward the mouse and opens
 * full size in the lightbox, with a link to the story or event it was published with. Without
 * JavaScript the tile links to the image file.
 */
export function GalleryGrid({ tiles, layout = "masonry" }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const row = layout === "row";
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
  const card = `tilt-3d skeleton group relative block overflow-hidden rounded-2xl bg-brand-50 shadow-card ring-1 ring-line ${row ? "aspect-square" : ""}`;
  const media = `zoom-media reveal-img w-full ${row ? "h-full object-cover" : "h-auto"}`;

  return (
    <>
      <ul
        className={
          row
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5"
            : "columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 lg:gap-5 [&>li]:mb-3 sm:[&>li]:mb-4 lg:[&>li]:mb-5"
        }
      >
        {tiles.map((t, i) => (
          <li key={t.href} className="reveal break-inside-avoid">
            <a
              href={t.image.url}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                setIndex(i);
                setOpen(true);
              }}
              onPointerMove={tilt}
              onPointerLeave={untilt}
              aria-label={`View photo: ${t.title || "Untitled post"}`}
              className={`${card} cursor-pointer`}
            >
              <Img media={t.image} alt={t.image.alt || t.title} className={media} />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-900/90 via-brand-900/45 to-transparent p-3 pt-9 text-left text-white sm:p-3.5 sm:pt-10 hover-reveal">
                <span lang={langOf(t.title)} className="line-clamp-2 block font-display text-sm font-semibold leading-snug sm:text-[0.9375rem]">
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

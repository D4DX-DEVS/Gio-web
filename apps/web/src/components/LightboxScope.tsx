"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbox, type LightboxItem } from "./Lightbox";

const IMAGE_FILE = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;

/** The full-size URL an image should open at, or null when it should behave normally (a link to a page, an icon). */
function zoomTarget(img: HTMLImageElement): string | null {
  if (img.closest("[data-no-zoom]")) return null;
  const w = Number(img.getAttribute("width"));
  if ((w && w < 80) || img.classList.contains("emoji")) return null;
  const link = img.closest("a");
  if (link) return IMAGE_FILE.test(link.pathname) ? link.href : null;
  return img.currentSrc || img.src || null;
}

const zoomables = (root: HTMLElement | null) => Array.from(root?.querySelectorAll<HTMLImageElement>("img") ?? []).filter((img) => zoomTarget(img));

function captionOf(img: HTMLImageElement): string {
  const fig = img.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
  return fig || img.alt.trim();
}

/**
 * Makes the photos inside its children open in the lightbox: images not wrapped in a link,
 * and images linked straight to an image file (WordPress galleries). Images linking to pages
 * keep working as links. Without JavaScript the children render and behave exactly as before.
 */
export function LightboxScope({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<LightboxItem[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // Mark zoomable images so they show a zoom cursor and, when not already inside a link, can be reached by keyboard.
  useEffect(() => {
    for (const img of zoomables(ref.current)) {
      img.dataset.zoomable = "";
      if (!img.closest("a")) {
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", `View image${img.alt ? `: ${img.alt}` : ""}`);
      }
    }
  }, []);

  const openAt = (img: HTMLImageElement) => {
    const all = zoomables(ref.current);
    setItems(all.map((i) => ({ src: zoomTarget(i)!, alt: i.alt, caption: captionOf(i) || undefined })));
    setIndex(all.indexOf(img));
    setOpen(true);
  };

  const fromEvent = (target: EventTarget): HTMLImageElement | null => {
    const el = target as HTMLElement;
    const img = el.tagName === "IMG" ? (el as HTMLImageElement) : el.tagName === "A" ? el.querySelector("img") : null;
    // Decided at click time, so content swapped in after mount (client navigation) still works.
    return img && ref.current?.contains(img) && zoomTarget(img) ? img : null;
  };

  return (
    <div
      ref={ref}
      className={className}
      onClick={(e) => {
        const img = fromEvent(e.target);
        if (!img || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openAt(img);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const img = fromEvent(e.target);
        if (!img || img.closest("a")) return; // links already turn Enter into a click
        e.preventDefault();
        openAt(img);
      }}
    >
      {children}
      <Lightbox items={items} index={index} open={open} onClose={() => setOpen(false)} onIndex={setIndex} />
    </div>
  );
}

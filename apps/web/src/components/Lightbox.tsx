"use client";
/* eslint-disable @next/next/no-img-element -- original files from R2, no transformation service */

import { useRef } from "react";
import { langOf } from "@/lib/text";
import { CloseButton, Modal } from "./Modal";

export interface LightboxItem {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  caption?: string;
  meta?: string;
  /** Optional link shown under the image (for example the story the photo belongs to). */
  href?: string;
  hrefLabel?: string;
}

interface Props {
  items: LightboxItem[];
  index: number | null;
  open: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
}

/** Full-screen image viewer: arrow keys and swipe move between images, Escape closes. */
export function Lightbox({ items, index, open, onClose, onIndex }: Props) {
  const touchX = useRef<number | null>(null);
  const item = index === null ? null : items[index];
  const many = items.length > 1;
  const go = (d: number) => {
    if (index === null || !many) return;
    onIndex((index + d + items.length) % items.length);
  };

  return (
    <Modal open={open && !!item} onClose={onClose} label="Image viewer" variant="fullscreen" className="text-white">
      {item && (
        <div
          data-no-zoom
          className="flex h-full w-full flex-col"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-5">
            <p className="text-sm text-white/80" aria-live="polite">
              {many ? `${index! + 1} / ${items.length}` : ""}
            </p>
            <CloseButton onClick={onClose} label="Close image viewer" className="text-white hover:bg-white/15" />
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <img
              key={item.src}
              src={item.src}
              alt={item.alt}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              className="max-h-full max-w-full animate-fade-in rounded-lg object-contain shadow-2xl"
            />
            {many && (
              <>
                <NavButton dir="prev" onClick={() => go(-1)} />
                <NavButton dir="next" onClick={() => go(1)} />
              </>
            )}
          </div>
          {(item.caption || item.meta || item.href) && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-3 text-center">
              {item.caption && (
                <p lang={langOf(item.caption)} className="font-display font-semibold leading-snug">
                  {item.caption}
                </p>
              )}
              {item.meta && <p className="mt-1 text-sm text-white/70">{item.meta}</p>}
              {item.href && (
                <a href={item.href} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50">
                  {item.hrefLabel ?? "Open"} <span aria-hidden>→</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function NavButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-white/30 active:scale-95 sm:h-12 sm:w-12 sm:bg-white/15 ${dir === "prev" ? "left-1 sm:left-3" : "right-1 sm:right-3"}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d={dir === "prev" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}

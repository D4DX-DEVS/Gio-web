"use client";
/* eslint-disable @next/next/no-img-element -- YouTube poster frames */

import { useEffect, useRef, useState } from "react";
import { EMBED_ALLOW, EMBED_REFERRER, embedUrl, posterImage, type PosterSize } from "@/lib/youtube";

export interface VideoCard {
  id: string;
  title: string;
  /** ISO date; absent for the homepage's featured video. */
  published?: string;
  /** Largest poster YouTube has; hqdefault when unknown. */
  poster?: PosterSize;
}

// Rendered poster widths: the grid sits in the page Container (76rem of content, 86rem from 2xl), with
// 1 column on phones, 2 from sm and 3 from lg; the featured card spans 2 columns from sm.
const FEATURED_SIZES = "(min-width: 1536px) 57rem, (min-width: 1024px) min(66vw, 50rem), 100vw";
const CARD_SIZES = "(min-width: 1536px) 28rem, (min-width: 1024px) min(33vw, 24rem), (min-width: 640px) 50vw, 100vw";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function PlayBadge({ size }: { size: "lg" | "sm" }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-accent-600 text-white shadow-xl shadow-black/30 transition duration-300 group-hover:scale-110 group-hover:bg-accent-500 ${
        size === "lg" ? "h-12 w-12 sm:h-16 sm:w-16" : "h-10 w-10 sm:h-12 sm:w-12"
      }`}
    >
      <svg viewBox="0 0 24 24" className={size === "lg" ? "ml-1 h-5 w-5 sm:h-7 sm:w-7" : "ml-0.5 h-4 w-4 sm:h-5 sm:w-5"} fill="currentColor" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

/**
 * Video cards that zoom in as they scroll into view and open the player in a pop-up.
 * The first card is the featured one and is shown larger. YouTube's player only loads
 * after a click (no third-party requests on page load except the poster frames).
 */
export function VideoCards({ videos }: { videos: VideoCard[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<VideoCard | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (active && !d.open) d.showModal();
    else if (!active && d.open) d.close();
  }, [active]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        {videos.map((v, k) => {
          const featured = k === 0;
          const poster = posterImage(v.id, v.poster);
          return (
            // The wrapper takes the scroll reveal (ScrollReveal.tsx), so the button's own hover lift stays free.
            <div key={v.id} className={`reveal-zoom ${featured ? "sm:col-span-2 lg:row-span-2" : ""}`}>
              <button
                type="button"
                onClick={() => setActive(v)}
                className="group relative block h-full w-full overflow-hidden rounded-2xl bg-brand-800 text-left shadow-lg shadow-black/20 ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1.15)] hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 hover:ring-accent-500/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500"
                aria-label={`Play video: ${v.title}`}
              >
                {/* On lg the featured card fills its two grid rows; that height only exists when other cards are there to make the rows. */}
                <div className={`relative overflow-hidden ${featured && videos.length > 1 ? "aspect-video lg:aspect-auto lg:h-full" : "aspect-video"}`}>
                  <img
                    src={poster.src}
                    srcSet={poster.srcSet}
                    sizes={featured ? FEATURED_SIZES : CARD_SIZES}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="reveal-img absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-brand-900/95 via-brand-900/25 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <PlayBadge size={featured ? "lg" : "sm"} />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 lg:p-5">
                    {featured && (
                      <span className="mb-2 inline-block rounded-full bg-accent-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">Featured</span>
                    )}
                    {/* No `block` here: it would override line-clamp's display and let long titles run over the play button. */}
                    <span className={`line-clamp-2 font-display font-semibold leading-snug ${featured ? "text-base sm:text-xl" : "text-[0.9375rem] sm:text-base"}`}>
                      {v.title}
                    </span>
                    {v.published && <span className="mt-1 block text-xs text-white/70 sm:text-sm">{dateFmt.format(new Date(v.published))}</span>}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <dialog
        ref={dialog}
        onClose={() => setActive(null)}
        onClick={(e) => e.target === e.currentTarget && setActive(null)}
        aria-label={active ? active.title : "Video player"}
        className="m-auto w-[min(64rem,calc(100vw_-_2rem),calc((100dvh_-_8.5rem)*16/9))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-brand-900/80 backdrop:backdrop-blur-sm open:animate-[video-pop_.35s_cubic-bezier(.2,.8,.2,1.2)_both]"
      >
        {active && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setActive(null)}
              className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:rotate-90 hover:bg-white/20"
              aria-label="Close video"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-2xl">
              <iframe
                src={embedUrl(active.id)}
                title={active.title}
                allow={EMBED_ALLOW}
                referrerPolicy={EMBED_REFERRER}
                allowFullScreen
                className="block h-full w-full"
              />
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-medium text-white sm:text-base">{active.title}</p>
          </div>
        )}
      </dialog>
    </>
  );
}

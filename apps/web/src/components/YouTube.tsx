"use client";
/* eslint-disable @next/next/no-img-element -- YouTube poster frame */

import { useState } from "react";
import { EMBED_ALLOW, EMBED_REFERRER, embedUrl, posterImage, type PosterSize } from "@/lib/youtube";

/**
 * Loads the YouTube player only after a click (no third-party requests on page load except the poster).
 * Pass `poster` from `bestPoster()` on the server for a sharp HD poster; without it the 480px one is used.
 */
export function YouTube({ id, title, poster }: { id: string; title: string; poster?: PosterSize }) {
  const [play, setPlay] = useState(false);
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  const img = posterImage(id, poster);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-xl shadow-brand-900/20">
      {play ? (
        <iframe
          src={embedUrl(id)}
          title={title}
          allow={EMBED_ALLOW}
          referrerPolicy={EMBED_REFERRER}
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play video: ${title}`}>
          <img
            src={img.src}
            srcSet={img.srcSet}
            sizes="(min-width: 1152px) 69rem, 100vw"
            alt=""
            className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100 motion-reduce:group-hover:scale-100"
            loading="lazy"
            decoding="async"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 sm:h-16 sm:w-16 text-white shadow-xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

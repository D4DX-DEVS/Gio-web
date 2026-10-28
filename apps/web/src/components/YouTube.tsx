"use client";
/* eslint-disable @next/next/no-img-element -- YouTube poster frame */

import { useState } from "react";

/** Loads the YouTube player only after a click (no third-party requests on page load except the poster). */
export function YouTube({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl shadow-brand-900/20">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play video: ${title}`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-600 text-white shadow-xl transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element -- original banner files from R2 */

import { useEffect, useState } from "react";

export interface Slide {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  href: string | null;
}

export function HeroCarousel({ slides, intervalMs = 5000 }: { slides: Slide[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), intervalMs);
    return () => clearInterval(t);
  }, [paused, slides.length, intervalMs]);

  if (!slides.length) return null;
  const first = slides[0];
  const [w, h] = first.width && first.height ? [first.width, first.height] : [1915, 650];

  return (
    <section aria-roledescription="carousel" aria-label="Highlights" className="relative overflow-hidden bg-brand-900" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* The banner spans the full width at its own aspect ratio, so the whole image shows edge to edge. */}
      <div className="hero-enter relative w-full overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
        {slides.map((s, i) => {
          const active = i === index;
          // Portrait and square posters would lose most of their text under object-cover, so they sit whole on a brand backdrop.
          const poster = !!(s.width && s.height && s.width / s.height < 1.6);
          const img = (
            <img
              src={s.url}
              alt={s.alt || `Banner ${i + 1} of ${slides.length}`}
              width={s.width ?? undefined}
              height={s.height ?? undefined}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              decoding="async"
              style={poster ? undefined : { transitionDuration: `${intervalMs + 1000}ms` }}
              className={
                poster
                  ? "h-full w-auto max-w-full rounded-md object-contain shadow-2xl ring-1 ring-white/15"
                  : `h-full w-full object-cover ease-out motion-safe:transition-transform ${active ? "motion-safe:scale-[1.04]" : "scale-100"}`
              }
            />
          );
          return (
            <div
              key={s.url}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-1000 ${active ? "opacity-100" : "pointer-events-none opacity-0"} ${poster ? "flex items-center justify-center bg-[radial-gradient(ellipse_at_center,var(--color-brand-700),var(--color-brand-900)_70%)] py-[2.5%]" : ""}`}
            >
              {s.href ? (
                <a href={s.href} tabIndex={active ? 0 : -1} className={poster ? "h-full" : undefined}>
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
        {/* Soft bottom shade keeps the dots readable on light photos. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/35 to-transparent" />
      </div>
      {slides.length > 1 && (
        <div className="hero-controls">
          <button type="button" onClick={() => setIndex((index - 1 + slides.length) % slides.length)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-brand-900 shadow backdrop-blur transition duration-200 hover:scale-110 hover:bg-white active:scale-95 sm:block lg:left-5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button type="button" onClick={() => setIndex((index + 1) % slides.length)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-brand-900 shadow backdrop-blur transition duration-200 hover:scale-110 hover:bg-white active:scale-95 sm:block lg:right-5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 sm:bottom-3">
            {slides.map((s, i) => (
              <button key={s.url} type="button" onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index} className={`h-1.5 rounded-full transition-all sm:h-2 ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80 sm:w-2"}`} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

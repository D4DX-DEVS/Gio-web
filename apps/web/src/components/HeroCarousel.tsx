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
  const ratio = first.width && first.height ? `${first.width} / ${first.height}` : "1915 / 650";

  return (
    <section aria-roledescription="carousel" aria-label="Highlights" className="relative bg-brand-900" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
        {slides.map((s, i) => {
          const img = (
            <img
              src={s.url}
              alt={s.alt || `Banner ${i + 1} of ${slides.length}`}
              width={s.width ?? undefined}
              height={s.height ?? undefined}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              className="h-full w-full object-cover"
            />
          );
          return (
            <div key={s.url} aria-hidden={i !== index} className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              {s.href ? (
                <a href={s.href} tabIndex={i === index ? 0 : -1}>
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => setIndex((index - 1 + slides.length) % slides.length)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-900 shadow transition hover:bg-white sm:block">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button type="button" onClick={() => setIndex((index + 1) % slides.length)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-900 shadow transition hover:bg-white sm:block">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button key={s.url} type="button" onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index} className={`h-2 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

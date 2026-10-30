"use client";
/* eslint-disable @next/next/no-img-element -- original banner files from R2 */

import { useEffect, useRef, useState } from "react";

export interface Slide {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  href: string | null;
}

const Chevron = ({ dir }: { dir: "prev" | "next" }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d={dir === "prev" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
  </svg>
);

export function HeroCarousel({ slides, intervalMs = 5000 }: { slides: Slide[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  // Hover and keyboard focus pause temporarily; the pause button stops rotation until pressed again.
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    if (hovered || stopped || count < 2) return;
    // People who ask for reduced motion get a still banner they can page through by hand.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [hovered, stopped, count, intervalMs]);

  if (!count) return null;
  const first = slides[0];
  const ratio = first.width && first.height ? `${first.width} / ${first.height}` : "1915 / 650";
  const go = (d: number) => setIndex((i) => (i + d + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      className="group/hero relative bg-brand-900"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
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
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
        {slides.map((s, i) => {
          const img = (
            <img
              src={s.url}
              alt={s.alt || `Banner ${i + 1} of ${count}`}
              width={s.width ?? undefined}
              height={s.height ?? undefined}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              className={`h-full w-full object-cover transition-transform duration-[6000ms] ease-out motion-reduce:transition-none ${i === index ? "scale-100" : "scale-[1.03]"}`}
            />
          );
          return (
            <div
              key={s.url}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              inert={i !== index}
              className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              {s.href ? <a href={s.href}>{img}</a> : img}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-900 opacity-0 shadow transition group-hover/hero:opacity-100 hover:bg-white focus-visible:opacity-100 active:scale-95 sm:flex"
          >
            <Chevron dir="prev" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-900 opacity-0 shadow transition group-hover/hero:opacity-100 hover:bg-white focus-visible:opacity-100 active:scale-95 sm:flex"
          >
            <Chevron dir="next" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1 sm:bottom-3">
            {slides.map((s, i) => (
              // The visible dot is small; the button around it keeps a comfortable tap target.
              <button key={s.url} type="button" onClick={() => setIndex(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index} className="group/dot flex h-6 items-center px-1">
                <span className={`block h-1.5 rounded-full shadow transition-all duration-300 sm:h-2 ${i === index ? "w-6 bg-white sm:w-7" : "w-1.5 bg-white/55 group-hover/dot:bg-white/85 sm:w-2"}`} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStopped((v) => !v)}
              aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-white transition hover:bg-black/40"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                {stopped ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
              </svg>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

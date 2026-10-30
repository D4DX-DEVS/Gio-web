"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Horizontal, snap-scrolling row with previous/next buttons for mouse and keyboard users.
 * Touch users swipe as before; the buttons hide at either end and when everything fits.
 */
export function ScrollRow({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const page = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  };

  const btn = "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-800 shadow-lift ring-1 ring-line transition hover:bg-brand-600 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-0 sm:flex";

  return (
    <div className="relative" role="region" aria-label={label}>
      <div ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 pt-1 [scrollbar-width:thin] sm:mx-0 sm:gap-5 sm:scroll-px-0 sm:px-0">
        {children}
      </div>
      <button type="button" onClick={() => page(-1)} disabled={edge.start} aria-label="Scroll back" className={`${btn} -left-2 lg:-left-5`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>
      <button type="button" onClick={() => page(1)} disabled={edge.end} aria-label="Scroll forward" className={`${btn} -right-2 lg:-right-5`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

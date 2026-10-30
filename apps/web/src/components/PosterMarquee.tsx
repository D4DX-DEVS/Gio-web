"use client";

import { useEffect, useRef, useState } from "react";

const SPEED = 40; // px per second
const IDLE_AFTER_TOUCH = 3000; // ms before auto-scroll resumes after a swipe, wheel or arrow click

/** Takes links and buttons inside an aria-hidden copy out of the tab order. */
const unfocusable = (el: HTMLElement | null) => {
  el?.querySelectorAll<HTMLElement>("a, button, [tabindex]").forEach((f) => (f.tabIndex = -1));
};

/**
 * Highlights row that drifts left on its own and loops seamlessly. The items are rendered three
 * times and the view is kept on the middle copy, so the arrows and swipes can always move either way.
 * Keeps moving on hover; pauses for keyboard focus and briefly after a swipe or arrow click.
 * Reduced-motion users get no drift, only arrows and swipe.
 */
export function PosterMarquee({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  const st = useRef({ pos: 0, focus: false, until: 0, last: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = st.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setW = () => (el.firstElementChild as HTMLElement).offsetWidth;
    const fitsNow = () => setW() <= el.clientWidth + 1;
    // Same picture, shifted into the middle copy.
    const centre = (x: number) => {
      const w = setW();
      while (x >= 2 * w) x -= w;
      while (x < w) x += w;
      return x;
    };

    const measure = () => setFits(fitsNow());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.scrollLeft = s.pos = centre(0);

    // A long swipe can reach the outer copies' far edges; hop back to the middle there.
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft < 1 || el.scrollLeft > max - 1) el.scrollLeft = centre(el.scrollLeft);
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const hold = () => (s.until = performance.now() + IDLE_AFTER_TOUCH);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });

    let raf = 0;
    let wasPaused = true;
    const tick = (t: number) => {
      const dt = s.last ? Math.min(t - s.last, 100) : 0;
      s.last = t;
      // An open lightbox holds the row still, so it closes onto the poster that was clicked.
      const paused = reduce.matches || s.focus || t < s.until || fitsNow() || document.querySelector("dialog[open]") !== null;
      if (!paused) {
        // Pick up wherever the user left it; integer scrollLeft would lose sub-pixel steps, so keep our own float.
        if (wasPaused) s.pos = centre(el.scrollLeft);
        s.pos = centre(s.pos + (SPEED * dt) / 1000);
        el.scrollLeft = s.pos;
      }
      wasPaused = paused;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
    };
  }, []);

  const page = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement).offsetWidth;
    // Re-centre instantly (looks identical), then glide one page.
    let x = el.scrollLeft;
    while (x >= 2 * w) x -= w;
    while (x < w) x += w;
    el.scrollLeft = x;
    st.current.until = performance.now() + IDLE_AFTER_TOUCH;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: smooth ? "smooth" : "auto" });
  };

  // The copies are what is on screen most of the time (the view sits on the middle one), so they
  // must take clicks and hover. A click on a copy's image is passed to the same image in the real
  // row, where an enclosing LightboxScope opens it. Links in a copy work as they are.
  const fromCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = (e.target as HTMLElement).closest("img");
    const real = ref.current?.firstElementChild;
    if (!img || img.closest("a") || !real) return;
    const k = Array.from(e.currentTarget.querySelectorAll("img")).indexOf(img);
    const twin = real.querySelectorAll("img")[k];
    if (!twin) return;
    e.preventDefault();
    e.stopPropagation();
    twin.click();
  };

  const btn = "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-800 shadow-lg ring-1 ring-line transition hover:bg-brand-600 hover:text-white active:scale-95 sm:h-10 sm:w-10";

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      // Only keyboard focus pauses; a clicked arrow keeps focus and must not stop the drift.
      onFocus={(e) => (st.current.focus = e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) st.current.focus = false;
      }}
    >
      {/* A scroller clips on both axes, so the padding (offset by the negative margin) is the room a
          poster has to grow into on hover. */}
      <div ref={ref} className="-mx-4 -my-3 flex overflow-x-auto px-4 pb-6 pt-4 [scrollbar-width:none] sm:-mx-3 sm:px-3 [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0">{children}</div>
        {!fits &&
          [1, 2].map((n) => (
            // Not inert: inert content ignores the pointer, which made the visible posters dead.
            // Hidden from assistive tech and the tab order instead; data-no-zoom keeps an enclosing
            // LightboxScope listing each poster once, not three times.
            <div key={n} ref={unfocusable} className="flex shrink-0" aria-hidden data-no-zoom onClick={fromCopy}>
              {children}
            </div>
          ))}
      </div>
      {!fits && (
        <>
          <button type="button" onClick={() => page(-1)} aria-label="Previous highlights" className={`${btn} left-1 sm:-left-5`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button type="button" onClick={() => page(1)} aria-label="Next highlights" className={`${btn} right-1 sm:-right-5`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

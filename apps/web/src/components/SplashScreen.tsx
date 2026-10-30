"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PublicMedia } from "@/lib/content";
import { Img } from "./Img";

/* First-visit welcome overlay. It is part of the server HTML, so it covers the page from the first
   paint instead of popping in after hydration. It shows once per browser session: client-side
   navigation keeps the site layout mounted, and a reload or a new page load inside the same session
   skips it. Never shown with prefers-reduced-motion. If JavaScript never runs, a CSS fail-safe in
   globals.css (.splash) fades it out on its own, so it can never block the site. */

const SEEN_KEY = "gio-splash-seen";
const MIN_MS = 1200; // counted from navigation start, so hydration time is part of it
const MAX_MS = 2500; // hard cap even if images are still loading
const EXIT_MS = 600; // matches the .splash[data-state="leave"] transition

// Runs while the HTML is parsed, before the first paint: hides the overlay on repeat visits and
// for reduced motion, so it never flashes. The attribute change is covered by suppressHydrationWarning.
const PRE_PAINT = `try{if(sessionStorage.getItem("${SEEN_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.getElementById("gio-splash").dataset.state="skip"}catch(e){}`;

type State = "show" | "leave" | "done";

export function SplashScreen({ logo, name }: { logo: PublicMedia | null; name: string }) {
  const [state, setState] = useState<State>("show");
  const ref = useRef<HTMLDivElement>(null);
  const checked = useRef(false);
  const skipped = useRef(false);

  // Before paint, so a client-side mount (e.g. coming from /admin), where the pre-paint script does
  // not run, also never flashes. Hidden through the DOM, the same way the script does it.
  // Decided once per mount: Strict Mode runs effects twice and must not read back its own write.
  useLayoutEffect(() => {
    if (!checked.current) {
      checked.current = true;
      skipped.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        skipped.current ||= sessionStorage.getItem(SEEN_KEY) !== null;
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Storage blocked: show it this once, it is short.
      }
    }
    if (skipped.current && ref.current) ref.current.dataset.state = "skip";
  }, []);

  useEffect(() => {
    if (state !== "show" || skipped.current) return;
    let cancelled = false;
    const leave = () => {
      if (!cancelled) setState("leave");
    };
    const elapsed = performance.now();
    const loaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });
    const minWait = new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, MIN_MS - elapsed)));
    const cap = setTimeout(leave, Math.max(0, MAX_MS - elapsed));
    Promise.all([loaded, minWait]).then(leave);
    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "leave") return;
    const t = setTimeout(() => setState("done"), EXIT_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "done") return null;

  return (
    <>
      <div ref={ref} id="gio-splash" className="splash" data-state={state} aria-hidden="true" suppressHydrationWarning>
        <div className="splash-card">
          <div className="splash-logo">
            <span className="splash-halo" />
            <Img media={logo} alt="" eager className="relative h-20 w-auto sm:h-24" fallbackLabel={name} />
          </div>
          <p className="splash-title text-lg font-semibold text-brand-800 sm:text-xl">Welcome to {name}</p>
          <span className="splash-bar" />
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      <noscript>
        <style>{".splash{display:none}"}</style>
      </noscript>
    </>
  );
}

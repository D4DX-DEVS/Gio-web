"use client";

import { useEffect } from "react";

/**
 * Stops the shimmer of `.skeleton` image frames once their picture has loaded (or failed).
 * It cancels the running CSS animation rather than adding a class: streamed page sections
 * hydrate after this effect runs, and a changed className there would be a hydration mismatch.
 * One capture-phase listener on the document covers every image, including ones added by later
 * client navigation.
 */
export function ImageLoadWatcher() {
  useEffect(() => {
    // Only the CSS shimmer: Web Animations on the same frame (scroll reveals, ScrollReveal.tsx) keep running.
    const done = (img: Element) => img.closest(".skeleton")?.getAnimations().forEach((a) => a instanceof CSSAnimation && a.cancel());
    document.querySelectorAll<HTMLImageElement>(".skeleton img, img.skeleton").forEach((img) => {
      if (img.complete) done(img);
    });
    const onLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) done(e.target);
    };
    document.addEventListener("load", onLoad, true);
    document.addEventListener("error", onLoad, true);
    return () => {
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("error", onLoad, true);
    };
  }, []);
  return null;
}

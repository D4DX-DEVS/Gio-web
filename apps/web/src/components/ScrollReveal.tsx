"use client";

import { useEffect } from "react";

/** Elements that fade and rise into place, scale up slightly, or reveal their children one by one. */
const TARGETS = ".reveal, .reveal-zoom, .reveal-group > *";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const STAGGER = 90; // ms between elements that enter together
const MAX_STEPS = 6;

const shape = (el: Element): Keyframe[] =>
  el.classList.contains("reveal-zoom")
    ? [{ opacity: 0, scale: "0.95", translate: "0 1rem" }, { opacity: 1, scale: "1", translate: "0 0" }]
    : [{ opacity: 0, translate: "0 1.5rem" }, { opacity: 1, translate: "0 0" }];

/**
 * Scroll reveals for the public site. Content below the fold is held at its start frame and plays in
 * when it scrolls into view; elements that enter together play one after another.
 *
 * Everything runs through the Web Animations API, so no class, attribute or style is written to the
 * DOM: streamed sections that hydrate later never see a mismatch. Server-rendered content is
 * visible until this runs (and stays visible without JavaScript); what is already on screen when it
 * runs is left alone. Content added later (streamed sections, client navigation) is held before it
 * paints and enters as soon as it is on screen. Reduced motion and printing show everything at once.
 *
 * Markup rules: put `.reveal` on a wrapper, not on an element with its own hover translate, scale or
 * opacity (the finished animation keeps its end frame and would override them), and don't nest targets.
 */
export function ScrollReveal() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;

    const held = new Map<Element, Animation>();

    const hold = (el: Element) => {
      if (held.has(el) || !(el instanceof HTMLElement)) return;
      const anim = el.animate(shape(el), { duration: el.classList.contains("reveal-zoom") ? 750 : 650, easing: EASE, fill: "both" });
      anim.pause();
      held.set(el, anim);
      io.observe(el);
    };

    const play = (el: Element, step: number) => {
      const anim = held.get(el);
      if (!anim) return;
      held.delete(el);
      io.unobserve(el);
      anim.effect?.updateTiming({ delay: step * STAGGER });
      anim.play();
      // Pictures settle from a slight zoom inside their frame (frames clip with overflow-hidden).
      el.querySelectorAll(".reveal-img").forEach((img) => img.animate([{ scale: "1.06" }, { scale: "1" }], { duration: 1000, delay: step * STAGGER, easing: EASE, fill: "backwards" }));
    };

    const showAll = () => {
      held.forEach((a) => a.finish());
      held.clear();
      io.disconnect();
    };

    // Enters once a fifth of it shows, or a strip of an eighth of the screen for blocks taller than
    // the screen, or all of it for a short last row at the very bottom of the page.
    const entered = (e: IntersectionObserverEntry) =>
      e.isIntersecting && (e.intersectionRatio >= 0.2 || e.intersectionRect.height >= (e.rootBounds?.height ?? window.innerHeight) / 8 || e.intersectionRatio > 0.99);

    const io = new IntersectionObserver(
      (entries) => {
        let step = 0;
        entries
          .filter((e) => entered(e) || e.boundingClientRect.bottom < 0)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((e) => {
            // Content the page has already scrolled past (anchor jump, restored scroll) just appears.
            if (!entered(e)) {
              held.get(e.target)?.finish();
              held.delete(e.target);
              io.unobserve(e.target);
              return;
            }
            play(e.target, Math.min(step++, MAX_STEPS));
          });
      },
      { threshold: [0, 0.05, 0.1, 0.2, 0.5, 1] },
    );

    // Server-rendered content: hold only what lies wholly below the fold, so nothing visible blinks.
    const fold = window.innerHeight;
    document.querySelectorAll(TARGETS).forEach((el) => {
      if (el.getBoundingClientRect().top > fold) hold(el);
    });

    // Added later: mutation callbacks run before the next paint, so new content never shows unheld.
    const each = (n: Node, fn: (el: Element) => void) => {
      if (!(n instanceof Element)) return;
      if (n.matches(TARGETS)) fn(n);
      n.querySelectorAll(TARGETS).forEach(fn);
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.removedNodes.forEach((n) =>
          each(n, (el) => {
            held.delete(el);
            io.unobserve(el);
          }),
        );
        r.addedNodes.forEach((n) => each(n, hold));
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const onMotion = () => motion.matches && showAll();
    motion.addEventListener("change", onMotion);
    window.addEventListener("beforeprint", showAll);
    return () => {
      mo.disconnect();
      showAll();
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("beforeprint", showAll);
    };
  }, []);
  return null;
}

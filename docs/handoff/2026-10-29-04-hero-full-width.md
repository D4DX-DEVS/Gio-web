# Handoff: home hero banner now full width (2026-10-29)

**Project:** GIO Kerala (giokerala.org) is being rebuilt from WordPress/Elementor as a Next.js site on Cloudflare (D1 + R2) with an admin dashboard. Work happens in the local git worktree `C:\dev\gio-kerala-web` (branch `phase-3/website`); the dev site runs at http://localhost:3000.

## What this task did
The user asked to remove the blurred "shades" on both sides of the home page hero slider and make the banner fit the full width.

- `apps/web/src/components/HeroCarousel.tsx`: removed the blurred background copy of each slide. Also removed the `maxWidth` cap that held the banner to 360px tall. The banner now spans the full page width at its own aspect ratio (1915 × 650), so the whole image shows edge to edge with no crop and no side fill.
- `apps/web/src/app/globals.css`: removed the `--hero-max-h: 360px` token, which nothing else used.

## Verified
- The rendered HTML at localhost:3000 shows the carousel with no blur layer and `aspect-ratio: 1915 / 650` on the full-width wrapper.
- Arrows, dots, autoplay and pause on hover are unchanged.

## Trade-off
The hero height now grows with screen width: about 650px on a 1920px screen and about 870px on a 2560px screen. Before, it was capped at 360px with blurred sides. If it feels too tall on large screens, the options are a max height that crops the image (object-cover) or a max height with letterboxing.

## Not done or pending
- Nothing has been committed. The worktree already holds a lot of uncommitted work waiting for the user's OK.
- Another Claude session (gio-new-18) is editing PosterMarquee, Sections, Lightbox, globals.css sizing tokens, views and Header. It was told about the one-line globals.css change.

## Questions for ChatGPT
1. Should the hero have a maximum height on very wide screens, and if so, should it crop or letterbox?
2. Should mobile get its own banner crop or image, since 1915 × 650 is only about 130px tall on a phone?
3. What should the next home-page polish step be?

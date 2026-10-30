# Handoff: homepage Highlights row (2026-10-29)

## What changed
- `apps/web/src/components/PosterMarquee.tsx` (new, client component): the Highlights posters now move to the left on their own, at 40 px/s, and loop without a visible seam.
  - The items are rendered three times and the view stays on the middle copy. The two extra copies are `inert`, `aria-hidden` and `data-no-zoom`, so screen readers, keyboard users and the lightbox each see every poster only once.
  - Previous and next arrows sit on both sides. Each click moves 80% of the row width and loops past either end.
  - Touch users can swipe. After a swipe, a mouse wheel or an arrow click, the row waits 3 s and then starts moving again.
  - The row keeps moving while the mouse is over it, as the user asked. It pauses only while keyboard focus is inside it.
  - With `prefers-reduced-motion` the row does not move by itself; the arrows and swiping still work.
  - When all the posters fit on screen, there is no movement, no arrows and no copies.
- `apps/web/src/components/Sections.tsx`, the `poster_slider` case: it now renders `<LightboxScope><PosterMarquee>`. Tapping or clicking a poster opens it full size in the existing Lightbox (swipe or arrow keys between posters, Escape closes). A poster that has a page link set in admin keeps working as a link.
- No content was added. `globals.css`, `Lightbox.tsx` and `LightboxScope.tsx` were not changed.

## Status
- Typecheck and ESLint pass for both files. The dev server on :3000 returns 200, and the markup renders as expected (checked with curl).
- Not checked in a real browser: the Chrome extension was not connected. The user should look at the movement, the arrows and the popup on desktop and on a phone.
- Not committed (branch `phase-3/website`, `C:\dev\gio-kerala-web`). It waits for the user's OK together with the other uncommitted work.
- Session gio-new-4d is doing a site-wide hover/zoom/lightbox pass in the same worktree. It was told about these edits.

## What next?
1. The user tests on localhost:3000 (desktop and phone) and asks for changes to the speed, arrow position or pause behaviour.
2. Port the same row to `phase-4/ui-polish` if that branch's `ScrollRow` version of Highlights should behave the same way.
3. Commit with the other `phase-3/website` work once the user approves.

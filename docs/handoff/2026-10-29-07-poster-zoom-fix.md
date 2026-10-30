# Handoff: Highlights poster hover zoom and click-to-open fix (2026-10-29)

## Project
GIO Kerala (giokerala.org) is being rebuilt from WordPress/Elementor as a Next.js 16 site on Cloudflare (D1 + R2), with an admin dashboard. Work happens in local git worktrees; this task was done in `C:\dev\gio-kerala-web` (branch `phase-3/website`, all changes uncommitted). Several Claude sessions edit this tree in parallel, so files were coordinated by message.

## What this task did
The user reported that the home page "Highlights: Campaigns & announcements" posters had no hover zoom and that clicking a poster did nothing.

**Why it failed before:**
1. The poster row (`PosterMarquee`) renders the posters three times so it can loop, and it keeps the view on the middle copy. The two extra copies were marked `inert`. Inert content ignores the mouse completely, so the posters on screen almost never received hover or clicks. Only the off-screen original copy was interactive.
2. The card hover was only a 2px lift (`hover:-translate-y-0.5`), and the scroll row had 4px of top padding. Any real zoom would have been clipped, because a horizontal scroller clips on both axes.
3. The lightbox fills the whole dialog, so the dialog's own "click the backdrop to close" never fired. Clicking outside the picture did not close it.

**Fixes:**
- `apps/web/src/components/PosterMarquee.tsx`
  - The copies are no longer inert. They stay `aria-hidden`, and their links and buttons are taken out of the tab order.
  - A click on a poster in a copy is passed to the same poster in the real row, where the existing `LightboxScope` opens it. The lightbox still lists each poster once (8 posters, not 24).
  - The scroller now has room for the zoom (`pt-4 pb-6 -my-3`, `sm:-mx-3 sm:px-3`), so the layout around it is unchanged.
  - Auto-scroll pauses while the lightbox is open, so the row is where you left it when the lightbox closes.
- `apps/web/src/components/Sections.tsx` (poster_slider card only)
  - Hover scales the whole card to 1.06 with a soft lifted shadow over 300ms, using the shared `--ease-soft` easing.
  - The pointer cursor shows on the card and the image.
  - The hovered card sits above its neighbours.
  - No zoom with reduced motion.
- `apps/web/src/components/Lightbox.tsx`
  - A click anywhere on the dark area (anything that is not the image, a button, a link or the caption) closes the viewer.
  - The image now pops in (fade plus zoom from 0.88, reusing the existing `video-pop` keyframes).
  - Closing uses the existing dialog fade and scale-down.

**Unchanged:**
- Escape to close, the × button, background scroll lock, the dark overlay and arrow/swipe navigation already existed in `Modal`/`Lightbox`.
- The lightbox shows the original full-size file (the same R2 URL as the card; there are no thumbnails).
- `object-contain` keeps the aspect ratio with no cropping.

## The "90% size" part
- I first scaled the public site to 90% (root font-size 90%, scoped to pages with the site header).
- The user then said the site felt too small. Two earlier "compact" passes by other sessions had already shrunk it, so mine compounded.
- I fully reverted my sizing change. `globals.css`, `Header.tsx` and `views.tsx` have none of my sizing edits left.
- A different session (gio-new-ef) then took over the opposite request (make the site larger: wider containers, larger type and cards). The poster cards are now `w-56 sm:w-64 lg:w-72 2xl:w-80` from that work.

## Verified (headless Chrome via DevTools protocol against the dev server at :3000)
After the peer's upsizing, at 1440×900:
- **Hover:** two different visible posters each scale to exactly 1.06 with the pointer cursor and are not clipped (the card stays inside the scroller box).
- **Click:** clicking three different posters opens the matching image each time (herizon, gaza, a WhatsApp poster).
  - The image keeps its aspect ratio and fits fully (for example 672×840 for a 1440×1801 file).
  - The dialog covers the header.
  - The page behind can't scroll (`overflow: hidden`).
- **Closing:**
  - Escape, outside click and the × button each close the viewer.
  - A frame-by-frame trace around Escape shows no jump in the row's position; focus returns to the page.
- **Arrows:** next and previous each move the row by about 900px; auto-scroll resumes afterwards.
- **No horizontal scroll** at 1366, 1440 and 1920 wide, and at 390 wide (mobile emulation).
- **Mobile (390×844, touch):** tapping a poster opens the viewer, and the image fills the width (374×499).
- **Typecheck:** `tsc --noEmit` passes.
- **Lint:** `eslint` passes on the three changed files.
- **Unit tests:** `npm test` gives 81 tests, 77 pass, 0 fail, 4 skipped.
- **Build:** `next build` completes.

Remarks:
- My test also flagged 2–3px of row movement between "before click" and "lightbox open". That is the drift during the click itself, not a bug.
- In dev, each poster image takes about 6 seconds to serve (large originals through the dev server), so posters can look blank for a few seconds on a cold load. This happened before this change too; production serves from R2.

## Not done
- No commit, per the standing rule that commits need the user's OK.
- Site-wide sizing is now owned by gio-new-ef; typography is owned by gio-new-f1.
- The poster thumbnail on the card is still cropped to 4:5 (`object-cover`), as before; the full poster shows in the viewer.

## Questions for ChatGPT
1. Should the Highlights row keep drifting while the mouse is over it? It does now (an earlier deliberate choice), which means a hovered poster slowly slides away under the cursor.
2. Should we commit the current `phase-3/website` state now, since many sessions have stacked uncommitted changes in it?
3. Should the dev server serve resized poster thumbnails (for example via Cloudflare Images) so the cards load faster, while the lightbox keeps the original?

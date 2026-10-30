# Handoff: homepage poster spotlight (2026-10-29)

## What changed
- `apps/web/src/components/Sections.tsx`: the standalone `image` section (the July 2026 GIO event poster above the Instagram banner on the homepage) is no longer a plain centred image. It now renders through a new `PosterSpotlight` component. This is the second version, made at the user's request; the first (a dark panel tinted by a blurred copy of the poster, with tilted backing cards) was replaced. The current version has:
  - a light `paper` panel with rounded corners and a slanted brand-blue band behind the poster, with a thin red stripe under it
  - two faint concentric rings (one solid, one dashed) centred on the poster
  - the poster upright in a white border, with four red corner brackets that grow and a slight image zoom on hover
  - no button: the user asked to remove the "View full size" button. If the admin sets a link on the image, the poster itself is clickable.
- No new content or text was added.

## Status
- Typecheck and ESLint pass. The dev server on :3000 renders the new markup (checked with curl). I could not take a browser screenshot because the Chrome extension was not connected.
- Not committed (branch `phase-3/website` in `C:\dev\gio-kerala-web`), waiting for the user's OK, alongside the existing uncommitted YouTube and admin work.

## Notes
- This applies to every standalone `image` section site-wide. An image followed by rich text still uses the side-by-side `ImageWithText` layout.

## What next?
1. The user reviews the new look on localhost:3000 and asks for tweaks (panel colour, tilt, button).
2. Decide whether to commit together with the pending YouTube and admin work.

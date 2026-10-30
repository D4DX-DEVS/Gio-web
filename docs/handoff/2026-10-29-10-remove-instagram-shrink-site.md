# Handoff: removed homepage Instagram banner, shrank public site

**Project:** Rebuild of giokerala.org (Girls Islamic Organization Kerala), moving from WordPress/Elementor to Next.js on Cloudflare (D1 + R2) with an admin dashboard. Work for this task was in the `C:\dev\gio-kerala-web` worktree (branch `phase-3/website`), which runs the dev server on localhost:3000.

## What this task did
1. **Removed the "Follow us on Instagram / @gio_kerala / Open Instagram" banner** from the homepage. In `apps/web/src/components/Sections.tsx`, the `instagram_feed` case now returns `null`, and the unused `SocialIcon` import is gone. The banner was a stand-in for the old site's live Instagram feed (Smash Balloon plugin). It only repeated the Instagram link already in the header top bar and footer. The `instagram_feed` section type remains in the schema, so a real feed can go here later if the client settles decision C11 (Meta API token or embed).
2. **Shrank the whole public site.** Tailwind sizes are rem, so the change lowers the root font size, which shrinks text, spacing and container widths together.
   - `apps/web/src/app/(site)/layout.tsx`: `<main>` now has `data-site`.
   - `apps/web/src/app/globals.css`: `html:has(main[data-site])` sets the root font size. Final values, set by session gio-new-a2: 93.75% below 1024px and 81.25% from 1024px up.
   - `--header-h` (the offset for the sticky header) now uses rem instead of px, so sticky sub-navs, the mobile menu and anchor scrolling stay aligned with the smaller header.
   - The admin (`/admin/**`) does not render `main[data-site]`, so it keeps the browser's default size.

## Verified
- Homepage at localhost:3000 returns 200, contains `data-site`, and no longer contains "Open Instagram".
- The admin page has no `data-site`.
- I couldn't check this visually: the Chrome extension wasn't connected.

## Not changed
- The Instagram icons in the header top bar and the footer stay.
- Nothing was committed. Commits wait for the user's OK.

## Questions for next step
1. Is the new size right on a 1920px desktop and on a phone, or should it go smaller or larger?
2. Should the Instagram section come back as a real live feed once the client provides a Meta token (C11), or stay off for good?
3. What homepage or UI item should come next?

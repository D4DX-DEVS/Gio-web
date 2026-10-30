# Handoff: wider page layout on large screens (2026-10-29)

## What changed
The public site's content was capped at 1440px wide (`2xl:max-w-[90rem]`), which left wide empty gutters on 1920px screens. The cap is now:

- below 1280px viewport: unchanged (`max-w-7xl`, 1280px)
- from 1280px (xl): 1408px (`xl:max-w-[88rem]`)
- from 1536px (2xl): 1600px (`2xl:max-w-[100rem]`)

Files (branch `phase-3/website`, worktree `C:\dev\gio-kerala-web`, uncommitted):
- `apps/web/src/components/ui.tsx`: `Container` width classes and doc comment
- `apps/web/src/components/Header.tsx`: top bar and main nav rows
- `apps/web/src/components/Footer.tsx`: footer grid and bottom bar

Header, footer and page body keep the same edges because they share the same classes.

## Verified
- Dev server on :3000 returns 200 and the new classes are in the rendered HTML.
- Not checked visually: the Chrome extension was not connected.

## Open points
- The user's browser showed a non-100% zoom icon; zoom changes how wide the page looks.
- Reading columns and forms that pass their own `max-w-*` (for example search at `max-w-6xl`) are unchanged on purpose.

## What next?
1. User checks the home page and an inner page at 100% zoom on a large screen.
2. If still too narrow, raise the 2xl cap (e.g. `2xl:max-w-[110rem]`) in the same three files.
3. Commit with the rest of `phase-3/website` once the user OKs it.

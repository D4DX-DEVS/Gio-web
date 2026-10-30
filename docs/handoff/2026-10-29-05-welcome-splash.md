# Handoff: first-visit welcome splash (2026-10-29)

**Project:** rebuild of giokerala.org (WordPress + Elementor) as Next.js 16 (App Router, React 19, Tailwind 4) on Cloudflare (OpenNext, D1 + R2), with an admin dashboard. Work happens in git worktrees under `C:\dev\gio-kerala*`. This task was done in `C:\dev\gio-kerala-web` (branch `phase-3/website`), which also serves the local dev demo on :3000.

## What this task did
Added a loading overlay that the public site shows once, when someone first opens it.

- **Look:** a full-screen paper-white background with faint brand-blue and red glows. The GIO Kerala logo (from site settings in D1) sits in a white rounded card that pops in with a fade, a zoom and a de-blur, wrapped by a soft pulsing ring. Below it is "Welcome to GIO Kerala" in the heading font and brand-800 blue, and a slim loading bar where a blue-to-red gradient slides along. The overlay leaves with a 0.6 s fade and a slight zoom-out. The logo, the name and the colours are the existing ones, so nothing new was invented.
- **When it shows:** only on the first page load of a browser session. Client-side navigation keeps the site layout mounted, so it never re-appears. A refresh or another full page load in the same session hides it before the first paint, so there is no flash. A new browser session shows it once again.
- **Timing:** it stays up for at least 1.2 s from navigation start, and longer if the page is still loading (it waits for the window `load` event). A hard cap ends it 2.5 s after navigation start even if images are still loading, and in any case it leaves as soon as hydration finishes. Total on-screen time is about 1.2 to 2.5 s.
- **Never blocks the site:**
  - Without JavaScript, a `<noscript>` style hides it.
  - If the script fails, a CSS fail-safe fades it out at 5 s.
  - It is `aria-hidden`, and the page content is rendered underneath the whole time, so SEO and screen readers are unaffected.
- **Accessibility:** it is skipped entirely with `prefers-reduced-motion: reduce` (enforced in both CSS and JS) and in print.
- **Scope:** public site only (`(site)` layout). The admin dashboard is untouched. No new dependencies.

## Files changed (uncommitted, waiting for the user's OK)
- `apps/web/src/components/SplashScreen.tsx` (new client component, about 95 lines).
- `apps/web/src/app/(site)/layout.tsx`: one import plus `<SplashScreen logo={site.logo} name={site.name} />`.
- `apps/web/src/app/globals.css`: one `.splash*` block appended at the end. Peer sessions' blocks are untouched.

## How it works (for reviewers)
- The overlay is in the server HTML. A tiny inline script right after it checks `sessionStorage["gio-splash-seen"]` and the reduced-motion preference, and sets `data-state="skip"` (CSS `display:none`) before the first paint. That attribute change is covered by `suppressHydrationWarning`.
- After hydration, `useLayoutEffect` makes the same decision once, which keeps it safe under Strict Mode's double effects and covers a client-side mount coming from /admin. Then `useEffect` waits for max(min time, load) or the cap, sets `leave`, and unmounts after the fade.

## Verified
- `tsc --noEmit` is clean. `eslint` on the changed files is clean.
- Headless Chrome (Playwright) against the :3000 dev server:
  1. First visit (desktop 1366x800): the splash showed, then `leave` and removal. `sessionStorage` flag set.
  2. Refresh in the same session: `skip`/`display:none` already at DOMContentLoaded, so no flash.
  3. Client navigation (/about-us/ to /team/): the splash never became visible.
  4. Mobile 390x844 and tablet 820x1180: shown, centred and correctly sized, then removed. Screenshots checked.
  5. Reduced motion: `skip` at DOMContentLoaded.
  6. JavaScript disabled: `display:none`.
  7. Console: no hydration warnings and no errors from the splash.

  The only 404 is the existing favicon `/wp-content/uploads/2025/03/cropped-icon-32x32.png`, which is not related. There is also an existing Next warning about `scroll-behavior: smooth` on `<html>`, also not related.

## Caveats / not done
- The dev server is very slow right now: 7 to 15 s to first byte, and media takes about 6 s per file. Exact timings were therefore not measured on a production build (`pnpm preview` on :8787 was not rebuilt, to avoid disturbing peer sessions). In dev the media is slow, so the logo can still be loading while the splash is up and the card looks empty. On R2 in production this should be brief, but it should be checked on the preview build.
- Not done on purpose: a version that shows on every visit, an artificial delay beyond 1.2 s, and any change to other sections.
- The favicon 404 and the `data-scroll-behavior` warning are left for a separate fix.

## Questions for ChatGPT
1. Is "once per browser session" the right frequency for this organisation's site, or should it be once ever (localStorage) or once per day?
2. Should the splash wait for the logo image specifically (and fade the logo in when ready), so the card is never empty on slow connections?
3. Should I fix the existing favicon 404 and add `data-scroll-behavior="smooth"` to `<html>` next, or rebuild the :8787 preview first to measure real timings?
4. Is it OK to commit this together with the other uncommitted website polish on `phase-3/website`, or as its own commit?

# Handoff: home hero banner enhanced (2026-10-29)

**Project:** GIO Kerala (giokerala.org) is being rebuilt from WordPress/Elementor as a Next.js site on Cloudflare (D1 + R2) with an admin dashboard. Work happens in the local git worktree `C:\dev\gio-kerala-web` (branch `phase-3/website`); the dev site runs at http://localhost:3000.

## What this task did
The user asked to "enhance the hero image". Only `apps/web/src/components/HeroCarousel.tsx` changed.

- **Slow zoom (Ken Burns):** the active banner zooms slowly from 100% to 104% over the slide's display time (interval + 1 s, 6 s by default). The zoom is off for visitors who set "reduce motion".
- **Bottom shade:** a soft dark gradient over the bottom quarter keeps the slide dots readable on light photos.
- **Portrait posters show in full:** a slide that is portrait or square (width/height below 1.6) is no longer cropped to a thin strip by `object-cover`. It sits whole and centred, with rounded corners and a shadow, on a radial gradient in brand blue. There is no blur, because the user removed the blurred side fill earlier. Today all 7 hero slides are 1915 × 650 banners, so this only applies when an admin adds a poster slide. The site's media includes posters such as 1080 × 1440, 1920 × 2560 and 703 × 850.
- **Decoding:** the images now use `decoding="async"`.

## Verified
- `tsc --noEmit` and ESLint on the file are clean.
- The server-rendered HTML at localhost:3000 shows 7 slides: slide 1 has the zoom class and `transition-duration: 6000ms`, slides 2-7 sit at `scale-100`, and the bottom shade is present.
- Not checked in a real browser. The Chrome extension was not connected, so the motion and the poster layout have not been seen on screen.

## Trade-off
The 4% zoom trims about 2% from each edge of the active banner as it grows. Text near the edge, such as the bottom of the "Dakshina Kerala Sammelanam" banner (bnr3), can be slightly clipped at the end of each cycle.

## Not done or pending
- Nothing is committed. The worktree holds a lot of uncommitted work waiting for the user's OK.
- Other sessions are editing the same worktree at the same time: gio-new-ef (site-wide upsizing) and gio-new-f1 (typography). Both were told that this task touches only HeroCarousel.tsx.
- Mobile height is unchanged: a 1915 × 650 banner is still only about 130 px tall on a 390 px phone.

## Questions for ChatGPT
1. Is a 4% slow zoom the right amount for photo banners, or should banners with text near the edge opt out?
2. Should mobile get a taller hero, by cropping with object-cover to a minimum height or with a separate mobile crop uploaded in the admin?
3. Should the admin warn or preview when a portrait poster is added as a hero slide?

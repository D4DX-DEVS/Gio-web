# Handoff: YouTube video quality and playback (2026-10-29)

**Project:** rebuild of giokerala.org (Girls Islamic Organization Kerala) from WordPress/Elementor to Next.js 16 + Tailwind 4 on Cloudflare (D1 + R2, via OpenNext), with an admin dashboard. Work runs in parallel git worktrees. This change is in `C:\dev\gio-kerala-web` (branch `phase-3/website`), which serves the dev site on localhost:3000.

## What was checked first
- The only YouTube content on the site is the homepage "Watch" block: one featured video (`GXMUeZOmWFs`, chosen on the old site) plus the channel's 5 newest uploads from its RSS feed, shown as cards that open YouTube's player in a pop-up. No imported post or page body contains a YouTube iframe (checked in the local D1 database).
- Measured in headless Chrome before changing anything:
  - The featured card is drawn at 740-815 px wide from YouTube's 480x360 `hqdefault` poster. That poster is 4:3 with black bars, so its real picture is only 480x270: the browser was enlarging it about 1.7x, which is why it looked soft.
  - The small cards used the 320x180 `mqdefault` poster. On a phone with a 3x screen these cards need about 1074 device pixels, so the poster was stretched about 3.4x.
  - The pop-up player was a correct 16:9 at 1024x576. On a 1366x657 laptop screen its close button was pushed above the top of the window.
  - Titles were meant to stop at 2 lines, but a `block` class overrode the line-clamp. On phones the long Malayalam featured title ran to 4 lines over the play button.

## What changed
- **Sharper posters.** The server checks once a week (HEAD request, cached) which poster sizes YouTube has for each video. All 6 current videos have the 1280x720 `maxresdefault`. Each card gets a `srcset` (320/480/640/1280 px) with `sizes` that match the grid, so the browser downloads the smallest poster that is still sharp for that screen. Desktop at 1x gets the 480 px poster for small cards and the 1280 px poster for the featured card; phones and retina screens get 1280 px. Videos without HD posters fall back to the largest one that exists.
- **Bigger player where there is room.** The pop-up is now up to 1280x720 (was capped at 1024x576) and is also limited by the window height, so the player, close button and title always fit on screen (1366x657 laptop: 926x521). YouTube picks its stream quality partly from the player's size, so a bigger player allows a higher automatic quality on large screens.
- **Player settings.** Still YouTube's official embed player (privacy-enhanced `youtube-nocookie.com`) with its own controls, quality menu, captions and fullscreen. Added `playsinline=1` (iPhones play inside the pop-up instead of jumping to fullscreen; fullscreen stays one tap away), an explicit `referrerpolicy="strict-origin-when-cross-origin"` (YouTube uses the referrer to identify the embedding site), and `web-share` in the iframe permissions. The player loads only after the visitor clicks play, so the autoplay after that click starts the video they chose. Nothing plays on page load.
- **Layout fixes.** Titles now stop at 2 lines. The featured play button is smaller on phones. The hover zoom on posters is reduced to 5% (was 10%). The featured card keeps a 16:9 shape even when the YouTube feed is down and it is the only card (it used to rely on the other cards for its height).
- **Rich text safety net.** Any YouTube or Vimeo iframe pasted into post or page content now fills the column at 16:9 instead of keeping fixed sizes such as 560x315. No current content uses this.
- The older single-player component `YouTube.tsx` (not used on this branch, still used by the phase-4/ui-polish branch) uses the same player settings and accepts an optional HD poster size.

## Files
- `apps/web/src/lib/youtube.ts`: `bestPoster()`, `posterImage()`, `embedUrl()`, shared iframe attributes.
- `apps/web/src/components/ChannelVideos.tsx`: looks up the poster size for each video.
- `apps/web/src/components/VideoCards.tsx`: srcset/sizes, player size, iframe attributes, title clamp, play-button size, fallback height.
- `apps/web/src/components/YouTube.tsx`: same helpers.
- `apps/web/src/app/globals.css`: 16:9 rule for video iframes in rich text.

## Verified
- `tsc --noEmit` and eslint on the changed files: clean.
- Headless Chrome against localhost:3000 at 1440x900 (1x and 2x), 1366x657, 820x1180 tablet (2x), 390x844 phone (3x) and 360x740 phone (2x). At every size the chosen poster is at least as wide as the card in device pixels. The player is exactly 16:9 at every size, fits inside the window, and opens and plays. Escape closes it and removes the iframe, which stops playback.
- Not tested: real iPhone/Android devices, and actual fullscreen. Headless Chrome cannot enter fullscreen; the fullscreen button is visible and the iframe has `allowFullScreen`.

## Limits (not fixable from our side)
- YouTube decides the stream quality (adaptive streaming, based on player size, screen, connection and what was uploaded). No supported embed parameter forces 1080p; the old `vq`/`hd` tricks no longer work. Visitors can still pick a quality in the player's gear menu. I did not measure the stream resolution, so I am not claiming it went up. The larger player only allows YouTube to choose higher.
- The featured video has black bars inside the video itself (a wide cinematic frame inside 16:9). They show on the card and in the player. Hiding them would mean cropping the frame, which I did not do.
- On a portrait phone the player is only as wide as the screen (about 358x201). Fullscreen or rotating the phone is the way to watch bigger.
- Phones now download larger posters (about 130-190 KB each instead of about 10 KB, lazy-loaded) in exchange for sharp images.

## Not done
- Nothing committed (commits need the owner's OK).
- No new videos, no changes to which videos appear, no changes to other sections.
- Merging with the phase-4/ui-polish branch will still conflict in the `featured_video` case in `Sections.tsx`. The peer session agreed the `ChannelVideos` version should win.

## Questions for next step
1. Is the extra poster weight on phones acceptable, or should phones get the 640 px posters (slightly softer, about a third of the size)?
2. Should the featured card crop the black bars that are part of the featured video, or always show the full frame?
3. Is it time to commit the video-cards work (this change plus the 2026-10-28-06 handoff) on `phase-3/website` and merge it into `integration/demo`?
4. Should someone test on a real iPhone and Android phone (playback inside the pop-up, fullscreen, rotation) before the client demo?

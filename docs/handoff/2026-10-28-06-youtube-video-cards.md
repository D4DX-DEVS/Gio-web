# Handoff: homepage YouTube video cards (2026-10-28)

**Project:** rebuild of giokerala.org (Girls Islamic Organization Kerala) from WordPress/Elementor to Next.js 16 + Tailwind 4 on Cloudflare (D1 + R2, via OpenNext), with an admin dashboard. Work runs in parallel git worktrees; this change is in `C:\dev\gio-kerala-web` (branch `phase-3/website`), which serves the dev site on localhost:3000.

## What this task did
The homepage "featured video" block used to show one large YouTube player. It is now a card grid:
- The featured video (the one chosen on the old site) is a large 2x2 card with its real YouTube title, fetched from YouTube's oEmbed endpoint.
- Next to it are the channel's 5 newest regular uploads (Shorts are left out because the cards are 16:9). They come from the public RSS feed of the official channel, youtube.com/@giokerala5691, the same channel the old site links to. No titles or videos were invented.
- Animations: the cards zoom in with a stagger as they scroll into view. On hover the card lifts, the thumbnail zooms and the play button grows. Clicking a card opens the player in a pop-up (native `<dialog>`, with a spring "pop" animation, Escape/backdrop/× to close). Reduced-motion users get no animation.
- A "Visit our channel" button links to the channel.
- The YouTube player loads only after a click; on page load only the poster images are requested.
- The feed is cached for 1 hour (oEmbed title for 24 hours). If YouTube is unreachable, the section falls back to the featured video alone.

## Files
- New: `apps/web/src/lib/youtube.ts` (feed + oEmbed fetchers), `apps/web/src/components/ChannelVideos.tsx` (server section), `apps/web/src/components/VideoCards.tsx` (client cards, reveal animation, pop-up player).
- Changed: `apps/web/src/components/Sections.tsx` (the featured_video case now renders `ChannelVideos`), `apps/web/src/app/globals.css` (added the `video-pop` keyframe).
- `components/YouTube.tsx` is no longer used but was kept.

## Verified
- `tsc --noEmit` and eslint on the changed files: clean.
- The homepage HTML on localhost:3000 contains 6 cards: the featured Waqf protest video plus 5 channel uploads (Thamkeen campus conference/students meet, "Connecting Knowledge Across Disciplines"), and the channel link.
- Not checked visually in a browser (the Chrome extension was not connected), so the animations still need a look by eye.
- On the first request the dev server was slow (19 s) and the feed timed out, so only the featured card showed. I raised the timeout from 4 s to 6 s; a reload showed all cards.

## Not done / open points
- Nothing committed (commits need the owner's OK).
- The `phase-4/ui-polish` worktree edits the same featured_video block in `Sections.tsx`, so merging the two will conflict. Session gio-new-84 was told.
- Cards fetch from YouTube at request time. There is no admin control over which videos appear (no curated list in D1).
- Several channel videos share the same title ("Thamkeen | Islamic Campus Conference | GIO KERALA"); the dates are what tell them apart.

## Questions for next step
1. Should the video list stay automatic (latest uploads), or should admins pick the videos in the dashboard (a curated list stored in D1)?
2. Should Shorts get their own vertical carousel, or stay hidden?
3. How should this be merged with the phase-4/ui-polish branch, which reworks the same section?
4. Should there be a full /videos page with every upload, or is the homepage section enough?

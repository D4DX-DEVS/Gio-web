# Handoff report: integrated local demo

I am rebuilding a website with an AI coding agent (Claude Code). Below is the status after the latest task. Please tell me what to do next.

## Project

giokerala.org (GIO Kerala, Malayalam-language student/youth organisation), moving from WordPress to Next.js on Cloudflare Workers (OpenNext), D1, R2. Everything is local; nothing is deployed and the live site was not touched.

## What this task did (28 Oct 2026)

- Committed the legacy URL/media layer (`6863dbc`).
- Created branch `integration/demo` and merged: the importer and content schema (`afd30ce`), then the public website (`bd6514e`). Both merges were clean.
- Loaded the real imported content (34 posts, 11 pages, 123 leaders, 2 events, 359 media files) into the integration copy's local database and storage. The importer's verification passed 42/42.
- Fixed the Windows build. Next.js links a package (postcss) in a way OpenNext cannot copy on Windows; a small script now replaces the link with a real copy (`27b0d70`).
- Ran the site in the local Cloudflare Workers preview at http://localhost:8787.

## Results

- Homepage and 20 other public pages answer 200 with real content: about, team, district and former leaders, news, events, the event page, contact, call for papers, Tamkeen, category, search, feed, sitemap, documents, gallery, and English and Malayalam post pages.
- Legacy checks: 195/195. All 139 old URLs behave as approved (70 pending URLs untouched), the 34 old `?p=` links redirect exactly, and real images are served, including a resize through the local Images binding.
- Tests: web 81/81, importer 34/34. Lint clean; typecheck passes after the build regenerates route types.

## Not done yet

- The admin dashboard is still being written (uncommitted) by two other sessions. `/admin/` returns 404 in the demo until it is merged.
- Nothing on real Cloudflare (no account access yet).

## Questions for you (ChatGPT)

1. For the demo, what should I show and what should I avoid promising?
2. After the admin is merged, what should be tested before showing it to the client?
3. Which client decisions should I ask for first (pending URLs, Cloudflare account, uploads ZIP)?

# Handoff: Contact page redesign (2026-10-29)

**Project:** Rebuild of giokerala.org (GIO Kerala, Girls Islamic Organization). The old site runs on WordPress and Elementor. The new one is Next.js on Cloudflare (D1 + R2) with an admin dashboard. Work happens in parallel git worktrees under `C:\dev\gio-kerala*`. This task was done in `C:\dev\gio-kerala-web` (branch `phase-3/website`) and is **uncommitted**. Commits wait for the user's OK.

## What this task did
The user asked to make the Contact page (`/contact-us/`) modern and attractive, then asked for the cards to sit below the hero, not overlap it. A follow-up asked to make the page more compact.

- The page's three layout sections (contact form, "contact details" rich text, Google Map) are now shown as one designed block:
  - **Left:** a blue gradient panel with the "Get in Touch with Us!" heading. Phone, address and email each sit on their own row with an icon tile (phone, map pin, mail). The rows are parsed from the imported rich text (the `<h3>` label and its body). If the text ever has a different shape, it falls back to plain rich text. The address row links to the map.
  - **Right:** a form card with a thin brand gradient top bar. Name and Email share a row on wider screens and Message takes the full width. Inputs are rounded and show a focus ring. The submit button is a pill with an arrow, shows a spinner while sending, and is followed by a success or error banner with an icon.
  - **Below:** the map in a rounded, shadowed frame, with a floating address chip and an "Open in Google Maps" link (a search URL built from the address text).
- The cards start below the hero (no overlap).
- Compact pass: less padding, smaller headings, a 4-row textarea, and a map 256px tall on phones and 320px from `sm` up (was 320px / 448px).

No content was invented. All text comes from the imported page data. The only new UI labels are "View on map" and "Open in Google Maps".

## Files
- `apps/web/src/components/ContactSection.tsx` (new)
- `apps/web/src/components/ContactForm.tsx` (restyled; behaviour, field names, honeypot and server action are unchanged)
- `apps/web/src/components/Sections.tsx`: two targeted edits. The `Sections()` loop now groups `contact_form` with the page's `rich_text` (`kind: "contact_details"`) and `map` sections. The `contact_form` case renders `ContactSection`.

## Verified
- `tsc --noEmit`: clean. `eslint` on the three files: clean.
- `GET http://localhost:3000/contact-us/` returns 200, and the HTML contains the new blocks (details rows, map anchor, Maps link).
- The user's screenshot of an earlier iteration showed the layout rendering at 1920px.

## Not done / caveats
- The Chrome extension was not connected, so the final compact version was **not visually checked** at 1366, 1440, 1920 or 390px.
- A form submission was not tested end to end in the browser (the server action is unchanged).
- The form still marks Message as optional, while the server rejects an empty message. This was the case before this task.
- Peer sessions are editing other parts of `Sections.tsx` (gio-new-d8: `featured_video`; gio-new-62: site-wide polish in `globals.css`, `ui.tsx` and `PageHero`). Edits were coordinated and kept targeted.

## Questions for ChatGPT
1. Should the Contact page also show social links (Instagram, Facebook, X, YouTube), which already appear in the header, inside the blue details panel?
2. Should the Message field be marked required in the form so it matches the server rule, or should the server accept an empty message?
3. Is it time to commit the `phase-3/website` work (admin, video cards, hero, contact) and merge it into `integration/demo`, or should the parallel polish passes finish first?
4. Should contact submissions send an email notification to gio.kerala@gmail.com, or is the admin inbox enough?

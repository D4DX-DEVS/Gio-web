# Handoff: admin login page redesign (with site logo)

**Project:** Rebuild of giokerala.org (old WordPress + Elementor site) as a Next.js app on Cloudflare (D1 database, R2 media) with its own admin dashboard. Brand colours are blue and red from the old site.

**This task:** Redesigned the admin sign-in page at `/admin/login/` and added the GIO Kerala logo to it.

## What changed

One file: `apps/web/src/app/admin/login/page.tsx` (worktree `C:\dev\gio-kerala-web`, branch `phase-3/website`, not committed).

- The page background is now a deep blue gradient with soft blurred blue and red shapes and a faint dot pattern. All of it is decorative.
- The card is split in two on tablet and desktop:
  - Left side: the full GIO Kerala logo on a light blue panel, with a thin blue-to-red bar across the top, the label "Admin dashboard" and the site tagline.
  - Right side: the heading "Welcome back", the email and password fields, the Sign in button and a "Back to website" link.
- On phones the card stacks into one column, with the logo on top and the form below it.
- The logo comes from the Logo setting in Admin → Settings (`logo_media`), which is the same image the public header uses. Changing the logo there also changes it on the login page. The old page hard-coded a small square icon instead.
- The error message now has `role="alert"`, so screen readers announce it.
- Sign-in logic is unchanged: the same server action, the same check for deactivated accounts and the same generic "Wrong email or password" message.

## Verified

- The page returns HTTP 200 on the local dev server (localhost:3000). The rendered HTML contains the logo `<img>` (`logo1.png`, 512×328), "Welcome back", "Admin dashboard" and "Back to website".
- TypeScript reported no errors for this file, and ESLint was clean.
- I could not take a screenshot because the Chrome extension was not connected, so the look has not been checked visually.
- The dev server took about 106 seconds to answer one request, probably because other sessions are using it at the same time. This is not caused by this change.

## Not done

- No show/hide password toggle and no "forgot password" link. There is no password reset flow yet; passwords are set with `scripts/create-admin.mjs`.
- No commit. Commits wait for the owner's OK.

## Questions for next step

1. Should the login page get a show/hide password toggle and a "forgot password" flow (email reset), or keep the CLI-only password reset for now?
2. Should the rest of the admin dashboard (sidebar and top bar) get the same logo and gradient style, so it matches the login page?
3. Is it time to commit the pending admin and website work on `phase-3/website`, or wait until the client's open decisions are settled?

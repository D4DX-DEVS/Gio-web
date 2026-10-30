# Handoff report: admin login security (env-only login, rate limiting, two-factor)

I am rebuilding a website with an AI coding agent (Claude Code). Below is the status after the latest task. Please tell me what to do next.

## Project

giokerala.org (GIO Kerala, a Malayalam-language student and youth organisation) is moving from WordPress to Next.js 16 on Cloudflare Workers (OpenNext), with D1 (SQLite) for content, R2 for media, and Better Auth for admin sessions. Everything runs locally. Nothing is deployed, nothing exists on a Cloudflare account yet, and the live WordPress site was not touched.

Several Claude Code sessions work in parallel, each in its own git worktree. This work is in `C:\dev\gio-kerala-web` (branch `phase-3/website`). The admin dashboard and many website changes in this worktree are still **uncommitted**.

## What this task did (29 Oct 2026)

**1. One admin login, taken only from the environment**
- The only way into `/admin` is `ADMIN_USERNAME` + `ADMIN_PASSWORD` (plus `ADMIN_TOTP_SECRET` when two-factor is on). Locally they live in `apps/web/.dev.vars` (git-ignored); in production they go in Cloudflare Worker secrets.
- Database accounts can no longer sign in. Behind the scenes Better Auth still keeps the session (in D1, removed on sign-out) for one fixed internal user, `env-admin`, so the audit log and revisions still record a user id.
- Each session is tied to the current credentials by a signed cookie. Changing the username, password or two-factor secret signs every session out at once.
- The old "Users" page (add people, roles, reset password) became a read-only "Admin access" page. The old account-creation script was removed.
- Better Auth's public web endpoints (sign-in, sign-up, get-session, password, user) now return 404. Only sign-out is left.

**2. Old credential file removed**
- `apps/web/.env.admin-login` was never committed and is not in git history. No code used it, so it was deleted. The demo guide was updated to match.

**3. TypeScript errors fixed**
- Another session had switched the posts, media and legacy-URLs admin pages to a new `contains()` search helper but forgot the import. The pages loaded, but every search crashed. The import is fixed, and search now works, including long Malayalam text.

**4. Login rate limiting**
- Login now posts to a route handler, `POST /admin/sign-in/`, so it can answer with a real HTTP 429 and `Retry-After`. The route also checks the Origin header against cross-site posts.
- Counters are stored in D1 (new table, migration `0002_admin_login_protection`), so all Worker instances share them.
- Limits: 5 failed attempts from one address in 15 minutes lock that address for 15 minutes; 50 failures from all addresses in 15 minutes lock sign-in for everyone for 15 minutes. Locks expire by themselves. A successful sign-in clears that address's counter.
- The client address comes only from Cloudflare's `CF-Connecting-IP` header, and only in production builds. `X-Forwarded-For` is never read. Addresses are stored hashed.

**5. Two-factor login (authenticator app)**
- Standard 6-digit authenticator codes (TOTP). The secret is an environment variable, made offline with `node scripts/generate-totp-secret.mjs`. There is no web page for setting it up, so only someone with server or Cloudflare access can do it.
- Codes are never stored. A used code cannot be reused (the last used time step is recorded in D1).
- Production builds refuse to sign anyone in until `ADMIN_TOTP_SECRET` is set. Locally it is optional and currently off.
- If the phone is lost, the recovery is to set a new secret. There are no backup codes.

## Results

- TypeScript: 0 errors. Lint: clean.
- Unit tests: 99 passed, 0 failed, 4 skipped (the skipped tests need a snapshot this worktree does not have; they were skipped before this task). New tests cover rate limiting (run against real SQLite with the real migration) and the official TOTP test vectors.
- Next.js production build (`pnpm build`): passes.
- End-to-end on the local dev server, all passed:
  - Signed-out visitors are sent to login, and the admin APIs refuse them.
  - Wrong password, wrong code, missing code and a reused code are all refused.
  - Correct credentials work, and all 14 admin sections return 200.
  - Forged cookies, expired sessions and sessions of old database accounts are refused.
  - Sign-out deletes the session.
  - The 6th attempt gets 429, even with the correct password, and fake IP headers do not get around it.
  - No secret appears in the browser code, page HTML or server log.

## Not done yet

- **Cloudflare build not run:** `pnpm build:cf` failed because the folder was locked by another session's running preview. I did not stop that session's preview.
- **Cloudflare Access is not set up**, and no code checks the Access token yet.
- **Cloudflare rate-limit rule is not configured.** The plan is to rate-limit POST `/admin/sign-in/` per IP.
- **Old accounts are still in the local database.** Four old admin accounts and 12 unexpired sessions remain. They can no longer get into the admin panel, but cleaning them up needs my approval.
- **Nothing is committed or deployed.**

## Questions for you (ChatGPT)

1. **Commit order:** what is a safe order to commit and merge this work? The admin dashboard, website changes from several sessions, and this security work are all uncommitted in one worktree, and another branch (`integration/demo`) is used for the demo.
2. **Cloudflare Access:** for a small staff team, what should the policy look like? Which identity provider, how long should sessions last, and should the code also check the Access token?
3. **Global lock:** is a global lock (50 failures per 15 minutes) a good idea when Access will sit in front of the admin, or should only the per-address lock remain?
4. **Recovery:** is "set a new two-factor secret through Cloudflare" an acceptable recovery for a lost phone, or should there be backup codes?
5. **Database cleanup:** should the old accounts be deactivated with their sessions deleted, or removed completely? Removing them loses the names on 15 audit-log entries.
6. **First deployment:** what should be checked before the first deployment to Cloudflare? For example, the Worker CPU limit for password hashing on the first sign-in, `workers_dev: false`, the production secrets, and running the migration on the remote database.

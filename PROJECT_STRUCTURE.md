# Project structure

One repository, one branch (`main`), one Next.js application. The frontend and backend are both inside `apps/web`: on Cloudflare Workers, server code runs as Next.js route handlers and server actions. There is no separate backend server.

## Folder tree

```
gio-kerala/
├── apps/
│   ├── web/                     the website: public site, admin dashboard and all server code
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (site)/      public pages (home, news, events, gallery, documents, search, pages by slug)
│   │   │   │   ├── admin/       admin dashboard (login, panel pages, upload and sign-in routes)
│   │   │   │   ├── api/auth/    auth endpoint (sign-out only)
│   │   │   │   ├── media/       serves images and files from R2
│   │   │   │   ├── feed/        RSS feed
│   │   │   │   ├── sitemap.ts, robots.ts, layout.tsx, globals.css, error.tsx, not-found.tsx
│   │   │   ├── components/      shared UI components (header, footer, carousel, lightbox, cards, ...)
│   │   │   ├── lib/             server logic: database access, content queries, auth, search, admin helpers
│   │   │   └── legacy/          old WordPress URL redirects and old image URLs
│   │   ├── public/              static files served as-is
│   │   ├── scripts/             helper scripts (legacy URL data generator, preview checker, TOTP secret)
│   │   ├── worker.ts            Cloudflare Worker entry (legacy layer first, then Next.js)
│   │   ├── wrangler.jsonc       Cloudflare config: D1 database, R2 buckets, Images binding
│   │   ├── open-next.config.ts  OpenNext (Next.js to Cloudflare) config
│   │   ├── next.config.ts
│   │   └── .dev.vars.example    local secrets template (copy to .dev.vars)
│   └── importer/                content importer: old WordPress snapshot into D1 and R2
│       ├── src/                 CLI (cli.ts) and pipeline steps: build, files, load, verify
│       └── test/
├── packages/
│   └── db/                      database schema and migrations, shared by web and importer
│       ├── src/schema/          tables (auth.ts, content.ts)
│       └── migrations/          SQL migrations applied to D1
├── docs/                        project documentation (see below)
├── scripts/
│   └── wordpress-audit/         Python scripts used to audit and snapshot the old WordPress site
├── migration/                   LOCAL ONLY, not in Git: WordPress snapshot, import bundle, image cache, reports
├── package.json                 root commands (pnpm dev, build, preview, test, importer, ...)
├── pnpm-workspace.yaml          workspace packages and install rules
├── .env.example                 names of every environment variable (no values)
├── README.md                    setup, run, build and deploy
└── PROJECT_STRUCTURE.md         this file
```

## Where to find things

| Looking for | Location |
|---|---|
| Main website pages | `apps/web/src/app/(site)/` |
| Homepage | `apps/web/src/app/(site)/page.tsx` |
| Admin dashboard | `apps/web/src/app/admin/(panel)/`, one folder per section: `posts`, `pages`, `events`, `leaders`, `media`, `gallery`, `documents`, `menus`, `homepage`, `inbox`, `review`, `urls`, `settings`, `users` |
| Admin login | page `apps/web/src/app/admin/login/`, form handler `apps/web/src/app/admin/sign-in/route.ts`, logic `apps/web/src/lib/auth.ts` and `apps/web/src/lib/admin/` (two-factor, rate limiting, access guard) |
| Backend / API | route handlers: `apps/web/src/app/api/auth/`, `admin/sign-in/`, `admin/media-upload/`, `admin/media-options/`, `media/`, `feed/`. Server actions: `actions.ts` files in each admin section, and `apps/web/src/lib/contact-action.ts` (contact form) |
| Business logic and data access | `apps/web/src/lib/` (`content.ts`, `search.ts`, `youtube.ts`, `sanitize.ts`, `db.ts`) |
| Database schema | `packages/db/src/schema/` |
| Database migrations | `packages/db/migrations/` |
| Database configuration | `apps/web/wrangler.jsonc` (D1 binding `DB`), `apps/web/src/lib/db.ts`, `packages/db/drizzle.config.ts` |
| Local database and media files | `apps/web/.wrangler/state/` (not in Git) |
| Shared components | `apps/web/src/components/` |
| Styles | `apps/web/src/app/globals.css` (Tailwind CSS 4) |
| Images and media | uploaded and imported images are stored in R2 (bucket binding `MEDIA`) and served by `apps/web/src/app/media/` and `apps/web/src/legacy/media-handler.ts`. Static files are in `apps/web/public/` |
| Old WordPress links | `apps/web/src/legacy/`, `apps/web/worker.ts` |
| Importer | `apps/importer/` (run with `pnpm importer <command>`) |
| Environment variables | `.env.example` (all names), `apps/web/.dev.vars.example` (local template) |
| Cloudflare deployment config | `apps/web/wrangler.jsonc`, `apps/web/open-next.config.ts`, `apps/web/public/_headers` |
| Tests | next to the code they test: `apps/web/src/**/*.test.ts` and `apps/importer/test/` |

## Documentation

| File | Contents |
|---|---|
| `README.md` | setup, environment, running, importer, build and deploy |
| `docs/DEMO-GUIDE.md` | how to demo the site and admin, plus what was migrated |
| `docs/migration/IMPORTER.md` | importer details |
| `docs/architecture/` | legacy URL and media layer; phase 1 technical results |
| `docs/audit/` | original audit of the WordPress site, migration design and open decisions |
| `docs/handoff/` | dated notes from each piece of work, in order |
| `docs/SETUP.md` | original setup log (historical) |

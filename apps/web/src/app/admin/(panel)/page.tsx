import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { galleryCount, homepageCounts } from "@/lib/admin/stats";
import { schema } from "@gio/db";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { Badge } from "@/lib/admin/ui";

export const metadata = { title: "Dashboard" };

// Outline icons (24px grid, drawn with currentColor) so the dashboard needs no icon package.
const ICONS = {
  news: "M4 5h13v14H6a2 2 0 0 1-2-2V5Zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 4h16M8 3v4M16 3v4",
  poster: "M6 3h12v18l-6-4-6 4V3Z",
  banner: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 10 5-5 4 4 3-3 6 6",
  video: "M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm14 3 4-2.5v9L17 14",
  gallery: "M7 3h12a2 2 0 0 1 2 2v12M3 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 9 4-4 3 3 2-2 5 5",
  image: "M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 5-5-5L5 20",
  pages: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5",
  review: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  mail: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 1 9 6 9-6",
  draft: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  check: "M5 13l4 4L19 7",
} as const;

function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

// Full class strings so Tailwind sees every colour it needs.
const TONE = {
  brand: { icon: "bg-brand-50 text-brand-600 ring-brand-100", bar: "from-brand-500 to-brand-300" },
  accent: { icon: "bg-red-50 text-accent-600 ring-red-100", bar: "from-accent-500 to-red-300" },
  amber: { icon: "bg-amber-50 text-amber-600 ring-amber-100", bar: "from-amber-500 to-amber-300" },
  emerald: { icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", bar: "from-emerald-500 to-emerald-300" },
  violet: { icon: "bg-violet-50 text-violet-600 ring-violet-100", bar: "from-violet-500 to-violet-300" },
  sky: { icon: "bg-sky-50 text-sky-600 ring-sky-100", bar: "from-sky-500 to-sky-300" },
} as const;

const ACTION_DOT: Record<string, string> = {
  create: "bg-emerald-500 ring-emerald-100",
  upload: "bg-emerald-500 ring-emerald-100",
  publish: "bg-brand-500 ring-brand-100",
  update: "bg-brand-400 ring-brand-100",
  replace: "bg-brand-400 ring-brand-100",
  reorder: "bg-violet-400 ring-violet-100",
  delete: "bg-accent-500 ring-red-100",
};

function Panel({ title, icon, aside, footer, className = "", children }: { title: string; icon: keyof typeof ICONS; aside?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col rounded-2xl border border-line bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-900">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-brand-600">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
          {title}
        </h2>
        {aside}
      </header>
      <div className="flex-1 px-4 py-2">{children}</div>
      {footer ? <footer className="border-t border-line px-4 py-2">{footer}</footer> : null}
    </section>
  );
}

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const { user } = await requireRole("contributor");
  const db = getDb();
  const s = schema;
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

  const [posts, drafts, pages, events, leaders, media, documents, pendingReview, newMessages, recentPosts, reviewByCode, activity] = await Promise.all([
    n(db.select({ n: count() }).from(s.posts).where(and(eq(s.posts.status, "published"), isNull(s.posts.deletedAt)))),
    n(db.select({ n: count() }).from(s.posts).where(and(eq(s.posts.status, "draft"), isNull(s.posts.deletedAt)))),
    n(db.select({ n: count() }).from(s.pages).where(isNull(s.pages.deletedAt))),
    n(db.select({ n: count() }).from(s.events).where(isNull(s.events.deletedAt))),
    n(db.select({ n: count() }).from(s.leaders)),
    n(db.select({ n: count() }).from(s.media).where(and(isNull(s.media.deletedAt), isNull(s.media.variantOfMediaId)))),
    n(db.select({ n: count() }).from(s.documents)),
    n(db.select({ n: count() }).from(s.reviewItems).where(eq(s.reviewItems.status, "pending"))),
    n(db.select({ n: count() }).from(s.contactSubmissions).where(eq(s.contactSubmissions.status, "new"))),
    db
      .select({ id: s.posts.id, title: s.posts.title, status: s.posts.status, publishedAt: s.posts.publishedAt, updatedAt: s.posts.updatedAt })
      .from(s.posts)
      .where(isNull(s.posts.deletedAt))
      .orderBy(desc(s.posts.updatedAt))
      .limit(6),
    db
      .select({ code: s.reviewItems.code, n: count() })
      .from(s.reviewItems)
      .where(eq(s.reviewItems.status, "pending"))
      .groupBy(s.reviewItems.code)
      .orderBy(desc(count()))
      .limit(8),
    db.select().from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(8),
  ]);
  const [home, gallery, upcoming, images, recentEvents] = await Promise.all([
    homepageCounts(db),
    galleryCount(db),
    n(
      db
        .select({ n: count() })
        .from(s.events)
        .where(and(inArray(s.events.status, ["published", "scheduled"]), isNull(s.events.deletedAt), sql`coalesce(${s.events.endsAt}, ${s.events.startsAt}) >= ${Date.now()}`)),
    ),
    n(db.select({ n: count() }).from(s.media).where(and(eq(s.media.kind, "image"), isNull(s.media.deletedAt), isNull(s.media.variantOfMediaId)))),
    db
      .select({ id: s.events.id, title: s.events.title, status: s.events.status, updatedAt: s.events.updatedAt })
      .from(s.events)
      .where(isNull(s.events.deletedAt))
      .orderBy(desc(s.events.updatedAt))
      .limit(6),
  ]);
  const recent = [
    ...recentPosts.map((p) => ({ key: `p${p.id}`, kind: "News", title: p.title, status: p.status, updatedAt: p.updatedAt, href: `/admin/posts/${p.id}/` })),
    ...recentEvents.map((e) => ({ key: `e${e.id}`, kind: "Event", title: e.title, status: e.status, updatedAt: e.updatedAt, href: `/admin/events/${e.id}/` })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);

  const live = home.published ? "on the homepage" : "homepage not published";
  const stats = [
    { label: "Published news & announcements", value: posts, href: "/admin/posts/?status=published", hint: `${drafts} draft${drafts === 1 ? "" : "s"}`, icon: "news", tone: "brand" },
    { label: "Events & programmes", value: events, href: "/admin/events/", hint: `${upcoming} upcoming`, icon: "calendar", tone: "amber" },
    { label: "Campaign posters", value: home.posters, href: "/admin/homepage/posters/", hint: live, icon: "poster", tone: "accent" },
    { label: "Homepage banners", value: home.banners, href: "/admin/homepage/banners/", hint: live, icon: "banner", tone: "violet" },
    { label: "Videos", value: home.videos, href: "/admin/homepage/videos/", hint: home.channelFill ? "chosen, plus newest from YouTube" : "chosen", icon: "video", tone: "accent" },
    { label: "Gallery photos", value: gallery, href: "/admin/gallery/", hint: "from posts and events", icon: "gallery", tone: "emerald" },
    { label: "Images in library", value: images, href: "/admin/media/?filter=images", hint: `${media} files in all`, icon: "image", tone: "sky" },
    { label: "Pages", value: pages, href: "/admin/pages/", hint: `${leaders} leaders · ${documents} documents`, icon: "pages", tone: "brand" },
  ] as const;
  const attention = [
    { label: "Awaiting review", value: pendingReview, href: "/admin/review/", icon: "review" },
    { label: "New messages", value: newMessages, href: "/admin/inbox/", icon: "mail" },
    { label: "Drafts", value: drafts, href: "/admin/posts/?status=draft", icon: "draft" },
  ] as const;
  const maxReview = Math.max(1, ...reviewByCode.map((r) => r.n));
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-5 py-4 text-white shadow-md shadow-brand-900/20 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-400/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 h-48 w-48 rounded-full bg-accent-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:18px_18px]" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200">{today}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {greeting()}, {user.name}
            </h1>
            <p className="mt-0.5 text-sm text-brand-100">Here is what is happening on the GIO Kerala website.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin/posts/new/" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Icon name="plus" className="h-4 w-4" /> New post
              </Link>
              <Link href="/admin/events/new/" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition hover:bg-white/20">
                <Icon name="plus" className="h-4 w-4" /> New event
              </Link>
              <Link href="/admin/homepage/posters/" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur transition hover:bg-white/20">
                <Icon name="poster" className="h-4 w-4" /> Homepage posters
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[22rem]">
            {attention.map((a) => (
              <Link key={a.label} href={a.href} className="group flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${a.value ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"}`}>
                  <Icon name={a.value ? a.icon : "check"} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold leading-tight tabular-nums">{a.value}</span>
                  <span className="block truncate text-[11px] text-brand-100">{a.label}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Website at a glance</h2>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((x) => (
          <Link
            key={x.label}
            href={x.href}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-900/5"
          >
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition duration-300 group-hover:scale-x-100 ${TONE[x.tone].bar}`} />
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${TONE[x.tone].icon}`}>
              <Icon name={x.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-bold leading-tight tracking-tight text-ink tabular-nums">{x.value.toLocaleString("en-IN")}</span>
                <span className="truncate text-xs font-medium text-ink">{x.label}</span>
              </span>
              <span className="block truncate text-[11px] text-muted">{x.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="Waiting for client review"
          icon="review"
          className="lg:col-span-2"
          aside={<span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{pendingReview} pending</span>}
          footer={
            <Link href="/admin/review/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-accent-600">
              Open review queue <Icon name="arrow" className="h-4 w-4" />
            </Link>
          }
        >
          {reviewByCode.length ? (
            <ul className="space-y-2 py-1 text-sm">
              {reviewByCode.map((r) => (
                <li key={r.code}>
                  <Link href={`/admin/review/?code=${encodeURIComponent(r.code)}`} className="group block">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="font-medium text-ink group-hover:text-brand-700">{r.code}</span>
                      <span className="text-xs font-semibold tabular-nums text-muted">{r.n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition group-hover:from-amber-500" style={{ width: `${Math.max(4, (r.n / maxReview) * 100)}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-muted">
              <Icon name="check" className="h-4 w-4 text-emerald-600" /> Nothing is waiting for review.
            </p>
          )}
        </Panel>

        <Panel title="Recently updated news and events" icon="news" className="lg:col-span-3">
          <ul className="-mx-2 text-sm">
            {recent.map((p) => (
              <li key={p.key}>
                <Link href={p.href} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-paper">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ring-1 ring-inset ${p.kind === "News" ? TONE.brand.icon : TONE.amber.icon}`}>
                    <Icon name={p.kind === "News" ? "news" : "calendar"} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink group-hover:text-brand-700">{p.title || "(no title)"}</span>
                    <span className="text-xs text-muted">
                      {p.kind} · {fmtDate(p.updatedAt)}
                    </span>
                  </span>
                  <Badge value={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent admin activity" icon="pulse" className="lg:col-span-5">
          {activity.length ? (
            <ol className="relative py-1 text-sm before:absolute before:bottom-4 before:left-[5px] before:top-4 before:w-px before:bg-line">
              {activity.map((a) => (
                <li key={a.id} className="relative flex justify-between gap-4 py-1.5 pl-7">
                  <span aria-hidden className={`absolute left-0 top-3 h-[11px] w-[11px] rounded-full ring-4 ${ACTION_DOT[a.action] ?? "bg-slate-400 ring-slate-100"}`} />
                  <span className="min-w-0">
                    <span className="font-semibold capitalize text-ink">{a.action.replaceAll("_", " ")}</span>{" "}
                    <span className="text-ink">
                      {a.entityType} #{a.entityId}
                    </span>
                    {a.summary ? <span className="text-muted"> · {a.summary}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{fmtDate(a.createdAt, true)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-muted">No changes made in the admin yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

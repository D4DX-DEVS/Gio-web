import Link from "next/link";
import type { EventCard as EventCardData, PostCard as PostCardData, PublicMedia } from "@/lib/content";
import { dayOf, eventHref, formatDate, formatTime, langOf, monthOf, postHref, stripHtml } from "@/lib/text";
import { ArrowRight, CalendarIcon, PinIcon } from "./Icons";
import { Img } from "./Img";

/** Entrance order for `.enter-up` (each step adds 110ms). Scroll reveals stagger on their own (ScrollReveal.tsx). */
export const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/** Page-width wrapper: 80rem, 88rem from xl, 100rem on very wide screens. A max-w-* in className replaces both (reading columns, forms). */
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const width = /(^|\s)max-w-/.test(className) ? "" : "max-w-7xl xl:max-w-[88rem] 2xl:max-w-[100rem]";
  return <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${width} ${className}`}>{children}</div>;
}

export function PageHero({ title, eyebrow, subtitle, image, crumbs }: { title: string; eyebrow?: string; subtitle?: string; image?: PublicMedia | null; crumbs?: { href: string; label: string }[] }) {
  return (
    <section className="relative overflow-hidden bg-brand-800 text-white">
      {image && <Img media={image} alt="" eager className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 via-brand-800/80 to-brand-600/60" />
      <div aria-hidden className="float-slow pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent-600/20 blur-3xl" />
      <div aria-hidden className="float-slow pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-brand-400/20 blur-3xl [animation-direction:alternate-reverse]" />
      <Container className="relative py-7 sm:py-10 lg:py-11">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="enter-up mb-2.5 text-sm text-brand-200">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="link-fx hover:text-white">
                  Home
                </Link>
              </li>
              {crumbs.map((c) => (
                <li key={c.href} className="flex items-center gap-1.5">
                  <span aria-hidden>/</span>
                  <Link href={c.href} className="link-fx hover:text-white">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && (
          <p className="enter-up mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent-500 sm:text-[0.8125rem]" style={delay(1)}>
            {eyebrow}
          </p>
        )}
        <h1 lang={langOf(title)} className="enter-up max-w-5xl font-display text-[1.625rem] font-bold leading-tight sm:text-3xl sm:leading-tight lg:text-[2.5rem] lg:leading-tight" style={delay(2)}>
          {title}
        </h1>
        {subtitle && (
          <p className="enter-up mt-2.5 max-w-3xl text-base text-brand-100" style={delay(3)}>
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div className="reveal mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div>
        {eyebrow && (
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600 sm:text-[0.8125rem]">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-accent-600" />
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-[1.375rem] font-bold leading-tight text-brand-900 sm:text-[1.625rem] lg:text-[1.875rem]">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-brand-600 hover:text-accent-600">
          <span className="link-fx">{action.label}</span>
          <ArrowRight className="icon-nudge h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export function PostCard({ post, featured = false }: { post: PostCardData; featured?: boolean }) {
  const title = post.title || "Untitled post";
  const excerpt = stripHtml(post.excerpt, featured ? 260 : 140);
  return (
    <article className="card-lift group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card hover:border-brand-200">
      <div className={`relative overflow-hidden bg-brand-50 ${post.image ? "skeleton" : ""} ${featured ? "aspect-video" : "aspect-[16/10]"}`}>
        <Img media={post.image} alt="" className="zoom-media reveal-img h-full w-full object-cover" fallbackLabel="No image published for this post" />
        {post.categories[0] && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-brand-700 shadow-sm">{post.categories[0].name.replace(/^gio /i, "GIO ")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 lg:p-5">
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()} className="text-xs font-medium uppercase tracking-wider text-muted">
            {formatDate(post.publishedAt)}
          </time>
        )}
        <h3 lang={langOf(title)} className={`mt-1.5 line-clamp-3 font-display font-semibold leading-snug text-brand-900 transition-colors group-hover:text-brand-600 ${featured ? "text-lg sm:text-xl" : "text-[1.0625rem] sm:text-lg"}`}>
          <Link href={postHref(post.slug)} className="after:absolute after:inset-0 after:rounded-2xl">
            {title}
          </Link>
        </h3>
        {excerpt && (
          <p lang={langOf(excerpt)} className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted sm:text-[0.9375rem]">
            {excerpt}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[0.9375rem] font-semibold text-brand-600 transition-colors group-hover:text-accent-600">
          Read more <ArrowRight className="icon-nudge h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

export function EventCard({ event }: { event: EventCardData }) {
  const upcoming = event.upcoming;
  return (
    <article className="card-lift group relative flex h-full overflow-hidden rounded-2xl border border-line bg-white shadow-card hover:border-brand-200">
      <div className={`flex w-16 shrink-0 flex-col items-center justify-center py-3 text-white transition-colors sm:w-20 ${upcoming ? "bg-accent-600 group-hover:bg-accent-700" : "bg-brand-600 group-hover:bg-brand-700"}`}>
        <span className="font-display text-xl font-bold leading-none sm:text-2xl">{dayOf(event.startsAt)}</span>
        <span className="mt-1 text-xs uppercase tracking-wider text-white/85 sm:text-sm">{monthOf(event.startsAt)}</span>
        <span className="text-xs text-white/75">{event.startsAt.getFullYear()}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-5">
        <span className={`mb-1.5 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${upcoming ? "bg-accent-600/10 text-accent-700" : "bg-brand-50 text-brand-700"}`}>{upcoming ? "Upcoming" : "Past event"}</span>
        <h3 lang={langOf(event.title)} className="line-clamp-3 font-display text-[1.0625rem] font-semibold leading-snug text-brand-900 transition-colors group-hover:text-brand-600 sm:text-lg">
          <Link href={eventHref(event.slug)} className="after:absolute after:inset-0 after:rounded-2xl">
            {event.title}
          </Link>
        </h3>
        <div className="mt-2 space-y-1 text-sm text-muted sm:text-[0.9375rem]">
          <p className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0 text-brand-400" />
            {formatDate(event.startsAt)}
            {!event.allDay && ` · ${formatTime(event.startsAt)}`}
          </p>
          {event.venue && (
            <p className="flex items-center gap-2">
              <PinIcon className="h-4 w-4 shrink-0 text-brand-400" />
              {event.venue}
            </p>
          )}
        </div>
      </div>
      {event.image && (
        <div className="skeleton hidden w-32 shrink-0 overflow-hidden sm:block lg:w-40">
          <Img media={event.image} alt="" className="zoom-media reveal-img h-full w-full object-cover" />
        </div>
      )}
    </article>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  return (
    <nav aria-label="Pagination" className="reveal mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-fx rounded-full border border-line px-4 py-2 text-[0.9375rem] font-medium hover:border-brand-300 hover:text-brand-700">
          ← Newer
        </Link>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? "page" : undefined}
          className={`btn-fx flex h-10 w-10 items-center justify-center rounded-full text-[0.9375rem] font-semibold ${n === page ? "bg-brand-600 text-white" : "border border-line hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"}`}
        >
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="btn-fx rounded-full border border-line px-4 py-2 text-[0.9375rem] font-medium hover:border-brand-300 hover:text-brand-700">
          Older →
        </Link>
      )}
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center">
      <svg viewBox="0 0 24 24" className="mx-auto mb-2.5 h-9 w-9 text-brand-300" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 14h8" />
      </svg>
      <p className="font-display text-lg font-semibold text-brand-800">{title}</p>
      {children && <div className="mt-2 text-base text-muted">{children}</div>}
    </div>
  );
}

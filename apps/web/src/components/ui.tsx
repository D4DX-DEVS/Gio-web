import Link from "next/link";
import type { EventCard as EventCardData, PostCard as PostCardData, PublicMedia } from "@/lib/content";
import { dayOf, eventHref, formatDate, formatTime, langOf, monthOf, postHref, stripHtml } from "@/lib/text";
import { ArrowRight, CalendarIcon, PinIcon } from "./Icons";
import { Img } from "./Img";

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function PageHero({ title, eyebrow, subtitle, image, crumbs }: { title: string; eyebrow?: string; subtitle?: string; image?: PublicMedia | null; crumbs?: { href: string; label: string }[] }) {
  return (
    <section className="relative overflow-hidden bg-brand-800 text-white">
      {image && <Img media={image} alt="" eager className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 via-brand-800/80 to-brand-600/60" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-600/20 blur-3xl" />
      <Container className="relative py-14 sm:py-20">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-brand-200">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              {crumbs.map((c) => (
                <li key={c.href} className="flex items-center gap-1.5">
                  <span aria-hidden>/</span>
                  <Link href={c.href} className="hover:text-white">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent-500">{eyebrow}</p>}
        <h1 lang={langOf(title)} className="max-w-4xl animate-fade-up font-display text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-2xl animate-fade-up text-lg text-brand-100 [animation-delay:120ms]">{subtitle}</p>}
      </Container>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent-600">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-bold text-brand-900 sm:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-accent-600">
          {action.label}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export function PostCard({ post, featured = false }: { post: PostCardData; featured?: boolean }) {
  const title = post.title || "Untitled post";
  const excerpt = stripHtml(post.excerpt, featured ? 260 : 140);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/10">
      <div className={`relative overflow-hidden bg-brand-50 ${featured ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        <Img media={post.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" fallbackLabel="No image published for this post" />
        {post.categories[0] && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">{post.categories[0].name.replace(/^gio /i, "GIO ")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()} className="text-xs font-medium uppercase tracking-wider text-muted">
            {formatDate(post.publishedAt)}
          </time>
        )}
        <h3 lang={langOf(title)} className={`mt-2 font-display font-semibold leading-snug text-brand-900 ${featured ? "text-xl sm:text-2xl" : "text-lg"}`}>
          <Link href={postHref(post.slug)} className="after:absolute after:inset-0 hover:text-brand-600">
            {title}
          </Link>
        </h3>
        {excerpt && (
          <p lang={langOf(excerpt)} className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
            {excerpt}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-600">
          Read more <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

export function EventCard({ event }: { event: EventCardData }) {
  const upcoming = event.upcoming;
  return (
    <article className="group relative flex overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/10">
      <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-brand-600 py-6 text-white sm:w-28">
        <span className="font-display text-3xl font-bold leading-none">{dayOf(event.startsAt)}</span>
        <span className="mt-1 text-sm uppercase tracking-wider text-brand-100">{monthOf(event.startsAt)}</span>
        <span className="text-xs text-brand-200">{event.startsAt.getFullYear()}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className={`mb-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${upcoming ? "bg-accent-600/10 text-accent-700" : "bg-brand-50 text-brand-700"}`}>{upcoming ? "Upcoming" : "Past event"}</span>
        <h3 lang={langOf(event.title)} className="font-display text-lg font-semibold leading-snug text-brand-900">
          <Link href={eventHref(event.slug)} className="after:absolute after:inset-0 hover:text-brand-600">
            {event.title}
          </Link>
        </h3>
        <div className="mt-3 space-y-1 text-sm text-muted">
          <p className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-brand-400" />
            {formatDate(event.startsAt)}
            {!event.allDay && ` · ${formatTime(event.startsAt)}`}
          </p>
          {event.venue && (
            <p className="flex items-center gap-2">
              <PinIcon className="h-4 w-4 text-brand-400" />
              {event.venue}
            </p>
          )}
        </div>
      </div>
      {event.image && (
        <div className="hidden w-40 shrink-0 overflow-hidden sm:block">
          <Img media={event.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
      )}
    </article>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-brand-300 hover:text-brand-700">
          ← Newer
        </Link>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? "page" : undefined}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${n === page ? "bg-brand-600 text-white" : "border border-line hover:border-brand-300 hover:text-brand-700"}`}
        >
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-brand-300 hover:text-brand-700">
          Older →
        </Link>
      )}
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-brand-800">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

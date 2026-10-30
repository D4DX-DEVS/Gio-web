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
      <Container className="relative py-10 sm:py-16">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-4 animate-fade-in text-sm text-brand-200">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden>/</span>
                  <Link href={c.href} aria-current={i === crumbs.length - 1 ? "page" : undefined} lang={langOf(c.label)} className="truncate transition-colors hover:text-white">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-3 animate-fade-in text-sm font-semibold uppercase tracking-[0.2em] text-accent-500">{eyebrow}</p>}
        <h1 lang={langOf(title)} className="max-w-4xl animate-fade-up text-balance font-display text-3xl font-bold leading-tight sm:text-[2.75rem] sm:leading-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-2xl animate-fade-up text-base text-brand-100 [animation-delay:120ms] sm:text-lg">{subtitle}</p>}
      </Container>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div>
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600 sm:text-sm">
            <span className="h-px w-6 bg-accent-600" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl font-bold text-brand-900 sm:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="group inline-flex items-center gap-2 rounded-full py-1 text-sm font-semibold text-brand-600 transition-colors hover:text-accent-600">
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

const categoryLabel = (name: string) => name.replace(/^gio /i, "GIO ");

export function PostCard({ post, featured = false }: { post: PostCardData; featured?: boolean }) {
  const title = post.title || "Untitled post";
  const excerpt = stripHtml(post.excerpt, featured ? 260 : 140);
  return (
    <article className="card-lift group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className={`relative overflow-hidden bg-brand-50 ${featured ? "aspect-[16/10]" : "aspect-[16/11]"}`}>
        <Img media={post.image} alt="" className="zoom-media h-full w-full object-cover" fallbackLabel="No image published for this post" />
        {post.categories[0] && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur">{categoryLabel(post.categories[0].name)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.publishedAt && (
          <time dateTime={post.publishedAt.toISOString()} className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatDate(post.publishedAt)}
          </time>
        )}
        <h3 lang={langOf(title)} className={`mt-2 font-display font-semibold leading-snug text-brand-900 transition-colors group-hover:text-brand-600 ${featured ? "text-xl sm:text-2xl" : "text-lg"}`}>
          {/* The link covers the whole card, so the card is one large click target. */}
          <Link href={postHref(post.slug)} className="after:absolute after:inset-0 after:rounded-2xl after:content-['']">
            {title}
          </Link>
        </h3>
        {excerpt && (
          <p lang={langOf(excerpt)} className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
            {excerpt}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand-600" aria-hidden>
          Read more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

export function EventCard({ event }: { event: EventCardData }) {
  const upcoming = event.upcoming;
  return (
    <article className="card-lift group relative flex h-full overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className={`flex w-20 shrink-0 flex-col items-center justify-center py-5 text-white sm:w-24 ${upcoming ? "bg-gradient-to-b from-accent-600 to-accent-700" : "bg-gradient-to-b from-brand-600 to-brand-700"}`}>
        <span className="font-display text-3xl font-bold leading-none">{dayOf(event.startsAt)}</span>
        <span className="mt-1 text-sm font-semibold uppercase tracking-wider text-white/90">{monthOf(event.startsAt)}</span>
        <span className="text-xs text-white/75">{event.startsAt.getFullYear()}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <span className={`mb-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${upcoming ? "bg-accent-600/10 text-accent-700" : "bg-brand-50 text-brand-700"}`}>
          {upcoming && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" aria-hidden />}
          {upcoming ? "Upcoming" : "Past event"}
        </span>
        <h3 lang={langOf(event.title)} className="font-display text-lg font-semibold leading-snug text-brand-900 transition-colors group-hover:text-brand-600">
          <Link href={eventHref(event.slug)} className="after:absolute after:inset-0 after:rounded-2xl after:content-['']">
            {event.title}
          </Link>
        </h3>
        <div className="mt-3 space-y-1.5 text-sm text-muted">
          <p className="flex items-start gap-2">
            <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            <span>
              {formatDate(event.startsAt)}
              {!event.allDay && ` · ${formatTime(event.startsAt)}`}
            </span>
          </p>
          {event.venue && (
            <p className="flex items-start gap-2">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              <span lang={langOf(event.venue)}>{event.venue}</span>
            </p>
          )}
        </div>
      </div>
      {event.image && (
        <div className="hidden w-36 shrink-0 overflow-hidden bg-brand-50 sm:block md:w-44">
          <Img media={event.image} alt="" className="zoom-media h-full w-full object-cover" />
        </div>
      )}
    </article>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  const pill = "inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition";
  const idle = "border border-line bg-white hover:border-brand-300 hover:text-brand-700";
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className={`${pill} ${idle} px-4`}>
          ← Newer
        </Link>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} className={`${pill} w-11 ${n === page ? "bg-brand-600 text-white shadow-card" : idle}`}>
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className={`${pill} ${idle} px-4`}>
          Older →
        </Link>
      )}
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-brand-800">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

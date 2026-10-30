// Loading placeholders for the route-level loading.tsx files. Each one mirrors the size and
// grid of the real content (PageHero, PostCard, EventCard, leader and gallery tiles), so the
// page does not jump when the data arrives. Shown only while a page is actually being fetched.
import { Container } from "./ui";

const line = "skeleton skeleton-line";

/** Wraps a loading screen: announced once to screen readers, hidden from them otherwise. */
export function LoadingRegion({ label = "Loading", children }: { label?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Same box as PageHero (crumbs, title, optional subtitle) on the brand background. */
export function PageHeroSkeleton({ subtitle = false }: { subtitle?: boolean }) {
  const bar = "block rounded-full bg-white/15 animate-pulse motion-reduce:animate-none";
  return (
    <section className="relative overflow-hidden bg-brand-800">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/90 via-brand-800/80 to-brand-600/60" />
      <Container className="relative py-7 sm:py-10 lg:py-11">
        <span className={`${bar} mb-3 h-4 w-32 sm:h-5`} />
        <span className={`${bar} h-7 w-3/4 max-w-xl sm:h-9 lg:h-10`} />
        {subtitle && <span className={`${bar} mt-4 h-4 w-1/2 max-w-md sm:h-5`} />}
      </Container>
    </section>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="skeleton aspect-[16/10]" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5 lg:p-6">
        <span className={`${line} w-24`} />
        <span className={`${line} h-5 w-11/12`} />
        <span className={`${line} h-5 w-2/3`} />
        <span className={`${line} mt-1 w-full`} />
        <span className={`${line} w-4/5`} />
        <span className={`${line} mt-auto w-24`} />
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="skeleton w-20 shrink-0 sm:w-24" style={{ minHeight: "8.5rem" }} />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5 lg:p-6">
        <span className={`${line} h-6 w-20`} />
        <span className={`${line} h-5 w-5/6`} />
        <span className={`${line} w-1/2`} />
        <span className={`${line} w-2/5`} />
      </div>
      <div className="skeleton hidden w-36 shrink-0 sm:block lg:w-44" />
    </div>
  );
}

export function PostGridSkeleton({ count = 6, tabs = false }: { count?: number; tabs?: boolean }) {
  return (
    <Container className="py-8 sm:py-10">
      {tabs && (
        <div className="mb-8 flex flex-wrap gap-2.5">
          {[16, 24, 24].map((w, i) => (
            <span key={i} className="skeleton h-10 rounded-full" style={{ width: `${w / 4}rem` }} />
          ))}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
        {Array.from({ length: count }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}

export function EventListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Container className="py-8 sm:py-10">
      <span className={`${line} mb-6 h-7 w-40`} />
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8">
        {Array.from({ length: count }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}

/** Masonry-like photo wall: varied heights so it reads as the gallery, not a card grid. */
export function GallerySkeleton() {
  const heights = [14, 18, 11, 16, 12, 19, 15, 10, 17, 13, 16, 12];
  return (
    <Container className="py-8 sm:py-10">
      <div className="columns-2 gap-4 sm:columns-3 sm:gap-5 lg:columns-4 lg:gap-6">
        {heights.map((h, i) => (
          <div key={i} className="skeleton mb-4 break-inside-avoid rounded-2xl sm:mb-5 lg:mb-6" style={{ height: `${h}rem` }} />
        ))}
      </div>
    </Container>
  );
}

export function DocumentListSkeleton() {
  return (
    <Container className="max-w-4xl space-y-3 py-8 sm:py-10">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:gap-5 sm:p-5">
          <span className="skeleton h-12 w-12 shrink-0 rounded-xl" />
          <span className="flex flex-1 flex-col gap-2.5">
            <span className={`${line} h-5 w-2/3`} />
            <span className={`${line} w-1/3`} />
          </span>
          <span className="skeleton hidden h-11 w-28 rounded-full sm:block" />
        </div>
      ))}
    </Container>
  );
}

/** Article or content page: a centred reading column of text lines with an image block. */
export function ArticleSkeleton() {
  return (
    <Container className="max-w-4xl py-7 sm:py-10">
      <div className="skeleton mb-8 aspect-video w-full rounded-2xl" />
      <div className="space-y-3.5">
        {[100, 96, 92, 98, 60, 0, 95, 100, 88, 70].map((w, i) => (w ? <span key={i} className={`${line} h-4`} style={{ width: `${w}%` }} /> : <span key={i} className="block h-3" />))}
      </div>
    </Container>
  );
}

/** Homepage: hero banner at the real banner ratio, then a news grid. */
export function HomeSkeleton() {
  return (
    <>
      <div className="skeleton w-full" style={{ aspectRatio: "1915 / 650" }} />
      <section className="bg-paper py-10 sm:py-12 lg:py-14">
        <Container>
          <span className={`${line} mb-3 w-28`} />
          <span className={`${line} mb-8 h-8 w-64`} />
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
            {Array.from({ length: 3 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

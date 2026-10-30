import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarIcon, ImageIcon, InfoIcon, NewsIcon } from "@/components/Icons";
import { Sections } from "@/components/Sections";
import { Container, EmptyState, EventCard, PostCard, SectionHeading } from "@/components/ui";
import { getPageLayout, getPublishedPage, getSiteInfo, latestPosts, listEvents } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("");
  return {
    title: { absolute: page?.seoTitle ?? "GIO Kerala | Girls Islamic Organization" },
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: "/" },
  };
}

/** Shortcuts to the site's main sections (existing routes only). */
const QUICK_LINKS = [
  { href: "/about-us/", label: "About GIO", Icon: InfoIcon },
  { href: "/news-events/", label: "News & stories", Icon: NewsIcon },
  { href: "/events/", label: "Events", Icon: CalendarIcon },
  { href: "/gallery/", label: "Gallery", Icon: ImageIcon },
];

export default async function HomePage() {
  const page = await getPublishedPage("");
  const [layout, news, events, site] = await Promise.all([page ? getPageLayout(page.id) : null, latestPosts(6), listEvents({ limit: 3 }), getSiteInfo()]);

  // Visible page heading and shortcuts, directly under the banner carousel. The organisation's
  // own introduction text follows further down, so it is not repeated here.
  const intro = (
    <section className="relative border-b border-line bg-gradient-to-b from-brand-50/70 to-white">
      <Container className="grid items-center gap-6 py-8 sm:py-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-16">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-bold text-brand-900 sm:text-4xl">
            {site.tagline && (
              <span className="mb-2 flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent-600 sm:text-sm">
                <span className="h-px w-6 bg-accent-600" aria-hidden />
                {site.tagline}
                <span className="sr-only">:</span>
              </span>
            )}
            {site.name}
          </h1>
        </div>
        <nav aria-label="Explore" className="animate-fade-up [animation-delay:120ms]">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link href={href} className="card-lift group flex h-full items-center gap-3 rounded-xl border border-line bg-white p-3 shadow-card sm:p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-brand-900 sm:text-[15px]">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  );

  const latest = (
    <section className="bg-paper py-12 sm:py-16">
      <Container>
        <div data-reveal>
          <SectionHeading eyebrow="Latest from GIO" title="News & stories" action={{ href: "/news-events/", label: "View all news" }} />
        </div>
        {news.length ? (
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {news.map((p) => (
              <div key={p.id} data-reveal>
                <PostCard post={p} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No news published yet" />
        )}
      </Container>
    </section>
  );

  const eventBlock = events.length ? (
    <section className="py-12 sm:py-16">
      <Container>
        <div data-reveal>
          <SectionHeading eyebrow="Programmes" title="Events" action={{ href: "/events/", label: "All events" }} />
        </div>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} data-reveal>
              <EventCard event={e} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  ) : null;

  if (!layout) {
    return (
      <>
        {intro}
        <Container className="py-16">
          <EmptyState title="The homepage has not been published yet">
            <Link href="/admin/" className="underline">
              Publish it from the admin
            </Link>
          </EmptyState>
        </Container>
        {latest}
        {eventBlock}
      </>
    );
  }

  // The introduction follows the banner carousel; latest news goes after the introduction
  // text; events after the poster slider.
  const idx = (t: string) => layout.sections.findIndex((s) => s.type === t);
  const inserts: Record<number, React.ReactNode> = {};
  const hero = idx("hero_carousel");
  const text = idx("rich_text");
  const posters = idx("poster_slider");
  const add = (at: number, node: React.ReactNode) => {
    inserts[at] = inserts[at] ? (
      <>
        {inserts[at]}
        {node}
      </>
    ) : (
      node
    );
  };
  if (hero >= 0) add(hero, intro);
  add(text >= 0 ? text : 0, latest);
  if (eventBlock) add(posters >= 0 ? posters : layout.sections.length - 1, eventBlock);

  return (
    <>
      {hero < 0 && intro}
      <Sections layout={layout} inserts={inserts} />
      <section className="pb-12 sm:pb-16">
        <Container>
          <div data-reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white shadow-lift sm:px-14 sm:py-12">
            <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-accent-600/30 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-brand-400/20 blur-2xl" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Connect with GIO Kerala</h2>
                <p className="mt-2 max-w-xl text-brand-100">Reach the state office for programmes, membership and media enquiries.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact-us/" className="group inline-flex items-center gap-2 rounded-full bg-accent-600 px-6 py-3 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-lg active:translate-y-0 active:scale-[0.97]">
                  Contact us
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/about-us/" className="rounded-full bg-white/10 px-6 py-3 font-semibold ring-1 ring-white/30 transition hover:bg-white/20 active:scale-[0.97]">
                  About GIO
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Sections } from "@/components/Sections";
import { Container, EmptyState, EventCard, PostCard, SectionHeading } from "@/components/ui";
import { getPageLayout, getPublishedPage, latestPosts, listEvents } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("");
  return {
    title: { absolute: page?.seoTitle ?? "GIO Kerala | Girls Islamic Organization" },
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  const page = await getPublishedPage("");
  const [layout, news, events] = await Promise.all([page ? getPageLayout(page.id) : null, latestPosts(6), listEvents({ limit: 3 })]);

  const latest = (
    <section className="bg-paper py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow="Latest from GIO" title="News & stories" action={{ href: "/news-events/", label: "View all news" }} />
        {news.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <EmptyState title="No news published yet" />
        )}
      </Container>
    </section>
  );

  const eventBlock = events.length ? (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow="Programmes" title="Events" action={{ href: "/events/", label: "All events" }} />
        <div className="grid gap-5 lg:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </Container>
    </section>
  ) : null;

  if (!layout) {
    return (
      <>
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

  // Latest news goes after the introduction text; events after the poster slider.
  const idx = (t: string) => layout.sections.findIndex((s) => s.type === t);
  const inserts: Record<number, React.ReactNode> = {};
  const intro = idx("rich_text");
  const posters = idx("poster_slider");
  inserts[intro >= 0 ? intro : 0] = latest;
  if (eventBlock) inserts[posters >= 0 ? posters : layout.sections.length - 1] = eventBlock;

  return (
    <>
      <h1 className="sr-only">GIO Kerala: Girls Islamic Organization</h1>
      <Sections layout={layout} inserts={inserts} />
      <section className="pb-16">
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-8 py-12 text-white shadow-xl sm:px-14">
            <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-accent-600/30 blur-2xl" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">Connect with GIO Kerala</h2>
                <p className="mt-2 max-w-xl text-brand-100">Reach the state office for programmes, membership and media enquiries.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact-us/" className="rounded-full bg-accent-600 px-6 py-3 font-semibold transition hover:bg-accent-700">
                  Contact us
                </Link>
                <Link href="/about-us/" className="rounded-full bg-white/10 px-6 py-3 font-semibold ring-1 ring-white/30 transition hover:bg-white/20">
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

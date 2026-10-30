import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GalleryGrid } from "@/components/GalleryGrid";
import { Sections } from "@/components/Sections";
import { HomeSkeleton, LoadingRegion } from "@/components/Skeletons";
import { Container, EmptyState, EventCard, PostCard, SectionHeading } from "@/components/ui";
import { galleryCollections, getPageLayout, getPublishedPage, getSiteInfo, latestPosts, listEvents, type SiteInfo } from "@/lib/content";
import { formatDate } from "@/lib/text";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage("");
  return {
    title: { absolute: page?.seoTitle ?? "GIO Kerala | Girls Islamic Organization" },
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: "/" },
  };
}

// The homepage never 404s, so its content can stream in behind a skeleton of the hero and news grid.
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Loading the homepage">
          <HomeSkeleton />
        </LoadingRegion>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

/** Page heading for screen readers and search engines; the banner carries the visual identity. */
function HomeHeading({ site }: { site: SiteInfo }) {
  return <h1 className="sr-only">{site.name}: Girls Islamic Organization</h1>;
}

async function HomeContent() {
  const page = await getPublishedPage("");
  const [layout, news, events, site, photos] = await Promise.all([
    page ? getPageLayout(page.id) : null,
    latestPosts(6),
    listEvents({ limit: 3 }),
    getSiteInfo(),
    galleryCollections(8),
  ]);

  const latest = (
    <section className="bg-paper py-10 sm:py-12 lg:py-14">
      <Container>
        <SectionHeading eyebrow="Latest from GIO" title="News & stories" action={{ href: "/news-events/", label: "View all news" }} />
        {news.length ? (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {news.map((p) => (
              <div key={p.id} className="reveal">
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
    <section className="py-10 sm:py-12 lg:py-14">
      <Container>
        <SectionHeading eyebrow="Programmes" title="Events" action={{ href: "/events/", label: "All events" }} />
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
          {events.map((e) => (
            <div key={e.id} className="reveal">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  ) : null;

  // The five newest gallery photos, each opening in the lightbox; the heading links to the full gallery.
  const galleryBlock = photos.length ? (
    <section className="bg-paper py-10 sm:py-12 lg:py-14">
      <Container>
        <SectionHeading eyebrow="Moments" title="Gallery" action={{ href: "/gallery/", label: "View gallery" }} />
        <GalleryGrid
          layout="row"
          tiles={photos.slice(0, 5).map((it) => ({ href: it.href, title: it.title, date: it.date ? formatDate(it.date) : "", image: it.image }))}
        />
      </Container>
    </section>
  ) : null;

  if (!layout) {
    return (
      <>
        <Container className="py-12">
          <EmptyState title="The homepage has not been published yet">
            <Link href="/admin/" className="underline">
              Publish it from the admin
            </Link>
          </EmptyState>
        </Container>
        {latest}
        {eventBlock}
        {galleryBlock}
      </>
    );
  }

  // "Our initiatives" (logo carousel) is shown after the gallery, wherever it sits in the saved layout.
  const main = { ...layout, sections: layout.sections.filter((s) => s.type !== "logo_carousel") };
  const initiatives = { ...layout, sections: layout.sections.filter((s) => s.type === "logo_carousel") };

  // Latest news goes after the introduction text; events after the poster slider.
  const idx = (t: string) => main.sections.findIndex((s) => s.type === t);
  const inserts: Record<number, React.ReactNode> = {};
  const intro = idx("rich_text");
  const posters = idx("poster_slider");
  inserts[intro >= 0 ? intro : 0] = latest;
  if (eventBlock) inserts[posters >= 0 ? posters : main.sections.length - 1] = eventBlock;
  // The page heading sits right under the banner carousel (or at the top when there is none).
  const hero = idx("hero_carousel");
  const heading = <HomeHeading site={site} />;
  if (hero >= 0)
    inserts[hero] = (
      <>
        {heading}
        {inserts[hero]}
      </>
    );

  return (
    <>
      {hero < 0 && heading}
      <Sections layout={main} inserts={inserts} />
      {galleryBlock}
      <Sections layout={initiatives} />
      <section className="pb-10 pt-2 sm:pb-14">
        <Container>
          <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-7 text-white shadow-lg sm:px-10 sm:py-9">
            <div aria-hidden className="float-slow pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent-600/30 blur-2xl" />
            <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl lg:text-[1.75rem]">Connect with GIO Kerala</h2>
                <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-brand-100 sm:text-base">Reach the state office for programmes, membership and media enquiries.</p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/contact-us/" className="btn-fx rounded-full bg-accent-600 px-6 py-2.5 text-[0.9375rem] font-semibold hover:bg-accent-700">
                  Contact us
                </Link>
                <Link href="/about-us/" className="btn-fx rounded-full bg-white/10 px-6 py-2.5 text-[0.9375rem] font-semibold ring-1 ring-white/30 hover:bg-white/20">
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

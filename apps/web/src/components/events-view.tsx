import { notFound } from "next/navigation";
import { schema } from "@gio/db";
import { eq } from "drizzle-orm";
import { listEvents } from "@/lib/content";
import { getDb } from "@/lib/db";
import { Container, EmptyState, EventCard, PageHero } from "./ui";

export async function EventsView({ category }: { category?: string }) {
  let title = "Events";
  if (category) {
    const [cat] = await getDb().select().from(schema.eventCategories).where(eq(schema.eventCategories.slug, category)).limit(1);
    if (!cat) notFound();
    title = `Events: ${cat.name}`;
  }
  const all = await listEvents({ category });
  const upcoming = all.filter((e) => e.upcoming).reverse();
  const past = all.filter((e) => !e.upcoming);
  return (
    <>
      <PageHero title={title} eyebrow="Programmes & camps" crumbs={[{ href: "/events/", label: "Events" }]} />
      <Container className="py-8 sm:py-10">
        <h2 className="reveal mb-4 font-display text-lg font-bold text-brand-900 sm:text-xl">Upcoming</h2>
        {upcoming.length ? (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
            {upcoming.map((e) => (
              <div key={e.id} className="reveal">
                <EventCard event={e} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming events are published right now.">Follow GIO Kerala on social media for new announcements.</EmptyState>
        )}
        {past.length > 0 && (
          <>
            <h2 className="reveal mb-4 mt-10 font-display text-lg font-bold text-brand-900 sm:text-xl">Past events</h2>
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
              {past.map((e) => (
                <div key={e.id} className="reveal">
                  <EventCard event={e} />
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  );
}

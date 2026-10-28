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
      <Container className="py-14">
        <h2 className="mb-6 font-display text-2xl font-bold text-brand-900">Upcoming</h2>
        {upcoming.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming events are published right now.">Follow GIO Kerala on social media for new announcements.</EmptyState>
        )}
        {past.length > 0 && (
          <>
            <h2 className="mb-6 mt-14 font-display text-2xl font-bold text-brand-900">Past events</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {past.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  );
}

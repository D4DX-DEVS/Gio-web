import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, PinIcon } from "@/components/Icons";
import { Img } from "@/components/Img";
import { Container, PageHero } from "@/components/ui";
import { getPublishedEvent } from "@/lib/content";
import { sanitize } from "@/lib/sanitize";
import { decodeSlug, formatDate, formatTime, langOf, postHref, stripHtml } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/event/[slug]">): Promise<Metadata> {
  const data = await getPublishedEvent(decodeSlug((await params).slug));
  if (!data) return {};
  return { title: data.event.title, description: stripHtml(data.event.descriptionHtml, 160) || undefined, openGraph: { images: data.image ? [data.image.url] : undefined } };
}

export default async function EventPage({ params }: PageProps<"/event/[slug]">) {
  const data = await getPublishedEvent(decodeSlug((await params).slug));
  if (!data) notFound();
  const { event, venue, image, report } = data;
  const body = sanitize(event.descriptionHtml);
  const sameDay = event.endsAt && formatDate(event.endsAt) === formatDate(event.startsAt);
  return (
    <>
      <PageHero title={event.title} eyebrow="Event" crumbs={[{ href: "/events/", label: "Events" }]} />
      <Container className="grid gap-10 py-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {image && (
            <figure className="mb-8 overflow-hidden rounded-2xl shadow-xl shadow-brand-900/10 ring-1 ring-line">
              <Img media={image} eager className="h-auto w-full" />
            </figure>
          )}
          {body && <div lang={langOf(stripHtml(body, 300))} className="prose-gio" dangerouslySetInnerHTML={{ __html: body }} />}
          {report && (
            <p className="mt-8">
              <Link href={postHref(report.slug)} className="btn btn-primary">
                Read the report: {report.title}
              </Link>
            </p>
          )}
        </div>
        <aside className="h-fit space-y-5 rounded-2xl border border-line bg-paper p-6 lg:sticky lg:top-28">
          <div className="flex gap-3">
            <CalendarIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">When</p>
              <p className="font-medium">
                {formatDate(event.startsAt)}
                {!event.allDay && `, ${formatTime(event.startsAt)}`}
              </p>
              {event.endsAt && (
                <p className="text-sm text-muted">
                  until {sameDay ? "" : `${formatDate(event.endsAt)}, `}
                  {formatTime(event.endsAt)}
                </p>
              )}
            </div>
          </div>
          {venue && (
            <div className="flex gap-3">
              <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Where</p>
                <p className="font-medium">{venue.name}</p>
                <p className="text-sm text-muted">{[venue.address, venue.city, venue.state, venue.postalCode].filter(Boolean).join(", ")}</p>
              </div>
            </div>
          )}
          {event.cost && (
            <p className="text-sm">
              <span className="font-semibold">Cost:</span> {event.cost}
            </p>
          )}
          {event.registrationUrl && (
            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
              Register
            </a>
          )}
          <Link href="/events/" className="btn btn-ghost w-full">
            ← All events
          </Link>
        </aside>
      </Container>
    </>
  );
}

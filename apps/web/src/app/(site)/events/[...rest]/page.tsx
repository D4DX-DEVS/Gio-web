import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventsView } from "@/components/events-view";
import { decodeSlug } from "@/lib/text";

// Old The Events Calendar views: /events/list/, /events/month/, /events/today/ and the same under
// /events/category/<slug>/. All of them show the event list (url_map.csv keeps these paths).
const VIEWS = new Set(["list", "month", "today"]);

export const metadata: Metadata = { title: "Events", alternates: { canonical: "/events/" } };

export default async function EventsSubPage({ params }: PageProps<"/events/[...rest]">) {
  const rest = (await params).rest;
  if (rest.length === 1 && VIEWS.has(rest[0])) return <EventsView />;
  if (rest[0] === "category" && rest.length >= 2 && rest.length <= 3 && (rest.length === 2 || VIEWS.has(rest[2]))) {
    return <EventsView category={decodeSlug(rest[1])} />;
  }
  notFound();
}

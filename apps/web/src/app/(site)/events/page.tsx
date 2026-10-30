import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsView } from "@/components/events-view";
import { EventListSkeleton, LoadingRegion, PageHeroSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = { title: "Events", alternates: { canonical: "/events/" } };

// The skeleton streams first while the events load. This route never 404s, so the boundary is safe
// here; /events/category/… can 404 and stays without one (a 404 inside a boundary is sent as 200).
export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Loading events">
          <PageHeroSkeleton />
          <EventListSkeleton />
        </LoadingRegion>
      }
    >
      <EventsView />
    </Suspense>
  );
}

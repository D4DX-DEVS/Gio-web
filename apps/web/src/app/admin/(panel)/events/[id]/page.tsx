import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { Card, PageHeader } from "@/lib/admin/ui";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("contributor");
  const id = Number((await params).id);
  const [event] = Number.isInteger(id) ? await getDb().select().from(s.events).where(eq(s.events.id, id)) : [];
  if (!event) notFound();
  return (
    <>
      <PageHeader
        title={event.title}
        actions={
          <>
            <a href={`/admin/preview/event/${event.id}/`} target="_blank" className="btn btn-ghost">
              Preview ↗
            </a>
            {event.status === "published" ? (
              <Link href={`/event/${encodeURIComponent(event.slug)}/`} target="_blank" className="btn btn-ghost">
                View ↗
              </Link>
            ) : null}
            <Link href="/admin/events/" className="btn btn-ghost">
              ← All events
            </Link>
          </>
        }
      />
      {hasRole(user, "editor") ? <EventForm event={event} canDelete={hasRole(user, "admin")} /> : <Card>Editing needs the editor role.</Card>}
    </>
  );
}

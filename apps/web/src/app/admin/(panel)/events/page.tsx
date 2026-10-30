import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { SubmitButton } from "@/lib/admin/client";
import { Badge, Card, EmptyRow, Field, PageHeader, Table } from "@/lib/admin/ui";
import { createVenue } from "./actions";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const { user } = await requireRole("contributor");
  const rows = await getDb()
    .select({ e: s.events, venue: s.venues.name })
    .from(s.events)
    .leftJoin(s.venues, eq(s.venues.id, s.events.venueId))
    .orderBy(desc(s.events.startsAt));
  const canEdit = hasRole(user, "editor");
  return (
    <>
      <PageHeader
        title="Events"
        description="Calendar events shown on /events/. Event reports are posts in the 'gio events' category."
        actions={
          canEdit ? (
            <Link href="/admin/events/new/" className="btn btn-primary">
              + New event
            </Link>
          ) : null
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>When</th>
            <th>Venue</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, venue }) => (
            <tr key={e.id}>
              <td className="font-medium">{e.title}</td>
              <td className="whitespace-nowrap">
                {fmtDate(e.startsAt, !e.allDay)}
                {e.endsAt ? <span className="text-muted"> to {fmtDate(e.endsAt, !e.allDay)}</span> : null}
              </td>
              <td className="text-muted">{venue ?? "—"}</td>
              <td>
                <Badge value={e.status} />
              </td>
              <td className="whitespace-nowrap">
                <Link href={`/admin/events/${e.id}/`} className="text-brand-700 hover:underline">
                  {canEdit ? "Edit" : "View"}
                </Link>
                {e.status === "published" ? (
                  <Link href={`/event/${encodeURIComponent(e.slug)}/`} target="_blank" className="ml-3 text-muted hover:underline">
                    View ↗
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <EmptyRow colSpan={5} /> : null}
        </tbody>
      </Table>
      {canEdit ? (
        <Card title="Add a venue" className="mt-6">
          <form action={createVenue} className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <Field label="Name">
              <input name="name" className="field" required />
            </Field>
            <Field label="Address">
              <input name="address" className="field" />
            </Field>
            <Field label="City">
              <input name="city" className="field" />
            </Field>
            <Field label="State">
              <input name="state" className="field" defaultValue="Kerala" />
            </Field>
            <SubmitButton>Add venue</SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}

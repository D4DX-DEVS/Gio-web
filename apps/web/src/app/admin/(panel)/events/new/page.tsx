import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/admin/guard";
import { PageHeader } from "@/lib/admin/ui";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEvent() {
  await requireRole("editor");
  return (
    <>
      <PageHeader
        title="New event"
        actions={
          <Link href="/admin/events/" className="btn btn-ghost">
            ← All events
          </Link>
        }
      />
      <EventForm />
    </>
  );
}

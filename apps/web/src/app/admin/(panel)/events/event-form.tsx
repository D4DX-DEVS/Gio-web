import { asc } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { mediaPreviews } from "@/lib/admin/media-options";
import { ConfirmButton, MediaPicker, SubmitButton } from "@/lib/admin/client";
import { toIstInput } from "@/lib/admin/form";
import { Card, Field } from "@/lib/admin/ui";
import { createEvent, deleteEvent, updateEvent } from "./actions";

type Event = typeof s.events.$inferSelect;

export async function EventForm({ event, canDelete }: { event?: Event; canDelete?: boolean }) {
  const db = getDb();
  const [venues, organizers, previews] = await Promise.all([
    db.select().from(s.venues).orderBy(asc(s.venues.name)),
    db.select().from(s.organizers).orderBy(asc(s.organizers.name)),
    mediaPreviews(db, [event?.featuredMediaId]),
  ]);
  return (
    <form action={event ? updateEvent : createEvent} className="grid gap-6 lg:grid-cols-3">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Card className="space-y-4 lg:col-span-2">
        <Field label="Title">
          <input name="title" className="field" required defaultValue={event?.title ?? ""} />
        </Field>
        <Field label="Slug (web address)" hint={event ? `/event/${event.slug}/ (changing it breaks old links)` : "Leave empty to make one from the title."}>
          <input name="slug" className="field" defaultValue={event?.slug ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (India time)">
            <input name="startsAt" type="datetime-local" className="field" required defaultValue={toIstInput(event?.startsAt)} />
          </Field>
          <Field label="Ends (India time)">
            <input name="endsAt" type="datetime-local" className="field" defaultValue={toIstInput(event?.endsAt)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allDay" defaultChecked={event?.allDay ?? false} /> All-day event
        </label>
        <Field label="Description" hint="HTML is allowed (paragraphs, links, images). Unsafe markup is removed on save.">
          <textarea name="descriptionHtml" rows={12} className="field font-mono text-sm" defaultValue={event?.descriptionHtml ?? ""} />
        </Field>
      </Card>
      <div className="space-y-6">
        <Card className="space-y-4">
          <Field label="Status">
            <select name="status" className="field" defaultValue={event?.status ?? "draft"}>
              <option value="draft">Draft (not on the website)</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <MediaPicker name="featuredMediaId" label="Featured image" defaultId={event?.featuredMediaId} preview={event?.featuredMediaId ? previews.get(event.featuredMediaId) : undefined} />
          <Field label="Venue">
            <select name="venueId" className="field" defaultValue={event?.venueId ?? ""}>
              <option value="">None</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.city ? `${v.name}, ${v.city}` : v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Organizer">
            <select name="organizerId" className="field" defaultValue={event?.organizerId ?? ""}>
              <option value="">None</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost">
            <input name="cost" className="field" defaultValue={event?.cost ?? ""} />
          </Field>
          <Field label="Website / registration link">
            <input name="websiteUrl" type="url" className="field" defaultValue={event?.websiteUrl ?? ""} />
          </Field>
        </Card>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>{event ? "Save" : "Create event"}</SubmitButton>
          {event && canDelete ? <ConfirmButton formAction={deleteEvent} message={`Delete "${event.title}"? This cannot be undone.`} /> : null}
        </div>
      </div>
    </form>
  );
}

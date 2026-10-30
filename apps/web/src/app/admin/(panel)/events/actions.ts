"use server";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { sanitize } from "@/lib/sanitize";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { bool, errorMessage, FormError, int, isRedirect, istDate, oneOf, req, slugify, str } from "@/lib/admin/form";

const STATUSES = ["draft", "scheduled", "published", "cancelled", "archived"] as const;

function values(fd: FormData) {
  const title = req(fd, "title", "Title");
  const startsAt = istDate(fd, "startsAt");
  if (!startsAt) throw new FormError("Start date and time are required.");
  const endsAt = istDate(fd, "endsAt");
  if (endsAt && endsAt < startsAt) throw new FormError("The end is before the start.");
  const website = str(fd, "websiteUrl");
  if (website && !/^https?:\/\//i.test(website)) throw new FormError("Website must start with https://");
  const html = str(fd, "descriptionHtml");
  const slug = slugify(str(fd, "slug") ?? title);
  if (!slug) throw new FormError("Slug is required.");
  return {
    title,
    slug,
    descriptionHtml: html ? sanitize(html) : null,
    startsAt,
    endsAt,
    allDay: bool(fd, "allDay"),
    venueId: int(fd, "venueId"),
    organizerId: int(fd, "organizerId"),
    featuredMediaId: int(fd, "featuredMediaId"),
    cost: str(fd, "cost"),
    websiteUrl: website,
    status: oneOf(fd, "status", STATUSES, "draft"),
  };
}

export async function createEvent(fd: FormData) {
  const { user } = await requireRole("editor");
  let id = 0;
  try {
    const v = values(fd);
    const [row] = await getDb().insert(s.events).values({ ...v, source: "manual" }).returning({ id: s.events.id });
    id = row.id;
    await audit(user.id, "create", "event", id, v.title);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/events/new/", errorMessage(e));
  }
  done(`/admin/events/${id}/`, "Event created.");
}

export async function updateEvent(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  if (!id) fail("/admin/events/", "Missing id.");
  try {
    const v = values(fd);
    await getDb().update(s.events).set({ ...v, updatedAt: new Date() }).where(eq(s.events.id, id));
    await audit(user.id, v.status === "published" ? "publish" : "update", "event", id, v.title);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/events/${id}/`, errorMessage(e));
  }
  done(`/admin/events/${id}/`, "Saved.");
}

export async function deleteEvent(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  if (!id) fail("/admin/events/", "Missing id.");
  try {
    const db = getDb();
    await db.delete(s.eventCategoryMap).where(eq(s.eventCategoryMap.eventId, id));
    await db.delete(s.mediaUsage).where(and(eq(s.mediaUsage.entityType, "event"), eq(s.mediaUsage.entityId, String(id))));
    await db.delete(s.events).where(eq(s.events.id, id));
    await audit(user.id, "delete", "event", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/events/${id}/`, errorMessage(e));
  }
  done("/admin/events/", "Event deleted.");
}

export async function createVenue(fd: FormData) {
  const { user } = await requireRole("editor");
  try {
    const name = req(fd, "name", "Venue name");
    const [row] = await getDb()
      .insert(s.venues)
      .values({ name, address: str(fd, "address"), city: str(fd, "city"), state: str(fd, "state"), source: "manual" })
      .returning({ id: s.venues.id });
    await audit(user.id, "create", "venue", row.id, name);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/events/", errorMessage(e));
  }
  done("/admin/events/", "Venue added.");
}

"use server";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { errorMessage, FormError, int, isRedirect, oneOf, str } from "@/lib/admin/form";

const DECISIONS = ["keep_as_is", "change_approved", "rejected", "pending"] as const;

/**
 * Corrections that can be applied automatically once the client has given the new value.
 * Anything else is recorded as decided and fixed by hand in its own editor.
 */
const APPLY: Record<string, Record<string, (id: number, v: string) => Promise<unknown>>> = {
  post: {
    title: (id, v) => getDb().update(s.posts).set({ title: v, reviewState: "client_approved", updatedAt: new Date() }).where(eq(s.posts.id, id)),
  },
  leader: {
    name: (id, v) => getDb().update(s.leaders).set({ name: v, reviewState: "client_approved", updatedAt: new Date() }).where(eq(s.leaders.id, id)),
    facebook_url: (id, v) => getDb().update(s.leaders).set({ facebookUrl: v, reviewState: "client_approved", updatedAt: new Date() }).where(eq(s.leaders.id, id)),
    instagram_url: (id, v) => getDb().update(s.leaders).set({ instagramUrl: v, reviewState: "client_approved", updatedAt: new Date() }).where(eq(s.leaders.id, id)),
  },
};

export async function decide(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  const back = safeBack(str(fd, "back"), "/admin/review/");
  let msg = "Decision saved.";
  try {
    if (!id) throw new FormError("Missing id.");
    const status = oneOf(fd, "status", DECISIONS, "pending");
    const note = str(fd, "note");
    const value = str(fd, "suggestedValue");
    const db = getDb();
    const [item] = await db.select().from(s.reviewItems).where(eq(s.reviewItems.id, id));
    if (!item) throw new FormError("Review item not found.");
    if (status === "change_approved" && !value) throw new FormError("Enter the corrected value the client approved.");

    let applied = false;
    if (status === "change_approved" && value && item.entityType && item.entityId && item.field) {
      const fn = APPLY[item.entityType]?.[item.field];
      if (fn) {
        if (/_url$/.test(item.field) && !/^https?:\/\//i.test(value)) throw new FormError("Links must start with https://");
        await fn(Number(item.entityId), value);
        applied = true;
      }
    }
    if (status === "keep_as_is" && item.entityType && item.entityId) {
      // The published value is confirmed: the record is no longer waiting for the client.
      const t = item.entityType === "post" ? s.posts : item.entityType === "leader" ? s.leaders : null;
      if (t) await db.update(t).set({ reviewState: "client_approved" }).where(eq(t.id, Number(item.entityId)));
    }
    await db
      .update(s.reviewItems)
      .set({
        status,
        suggestedValue: status === "change_approved" ? value : item.suggestedValue,
        decisionNote: note,
        decidedBy: status === "pending" ? null : user.id,
        decidedAt: status === "pending" ? null : new Date(),
      })
      .where(eq(s.reviewItems.id, id));
    await audit(user.id, "review_decision", "review_item", id, `${item.code} ${status}${applied ? " (applied)" : ""}${note ? `: ${note}` : ""}`);
    if (status === "change_approved") msg = applied ? "Correction approved and applied." : "Correction approved. Apply it in the item's own editor.";
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(back, errorMessage(e));
  }
  done(back, msg);
}

/** Only return to an admin page on this site (the value comes from the form). */
function safeBack(v: string | null, fallback: string): string {
  return v && v.startsWith("/admin/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

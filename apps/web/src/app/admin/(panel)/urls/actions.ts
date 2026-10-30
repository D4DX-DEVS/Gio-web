"use server";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { errorMessage, FormError, int, isRedirect, oneOf, str } from "@/lib/admin/form";

/**
 * Record the client's decision for an old URL and create the redirect it implies.
 * 301 needs a target path on this site; 410 means "gone, no replacement".
 * Only URLs decided here (client_approved) ever produce a redirect.
 */
export async function decideUrl(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  const back = safeBack(str(fd, "back"), "/admin/urls/");
  try {
    if (!id) throw new FormError("Missing id.");
    const action = oneOf(fd, "action", ["redirect_301", "gone_410", "pending_decision"] as const, "pending_decision");
    const db = getDb();
    const [u] = await db.select().from(s.legacyUrls).where(eq(s.legacyUrls.id, id));
    if (!u) throw new FormError("URL not found.");
    if (u.action === "same_path") throw new FormError("This URL is kept at the same address; there is nothing to decide.");
    let target: string | null = null;
    if (action === "redirect_301") {
      target = str(fd, "target");
      if (!target || !target.startsWith("/") || target.startsWith("//")) throw new FormError("Enter a target path on this site, starting with / (for example /team/).");
      if (!target.endsWith("/") && !target.includes("?") && !/\.[a-z0-9]+$/i.test(target)) target = `${target}/`;
      if (target === u.oldPath || target === u.oldPathDecoded) throw new FormError("A URL cannot redirect to itself.");
    }
    await db.delete(s.redirects).where(and(eq(s.redirects.legacyUrlId, id), eq(s.redirects.origin, "migration")));
    if (action === "pending_decision") {
      await db
        .update(s.legacyUrls)
        .set({ action, newPath: null, decisionStatus: "needs_client_approval", decidedBy: null, decidedAt: null })
        .where(eq(s.legacyUrls.id, id));
    } else {
      await db
        .update(s.legacyUrls)
        .set({ action, newPath: target, decisionStatus: "client_approved", decidedBy: user.id, decidedAt: new Date(), note: str(fd, "note") ?? u.note })
        .where(eq(s.legacyUrls.id, id));
      await db.insert(s.redirects).values({
        fromPath: u.oldPath,
        toPath: target,
        statusCode: action === "gone_410" ? 410 : 301,
        origin: "migration",
        legacyUrlId: id,
        note: str(fd, "note"),
      });
    }
    // Keep the matching review item in step with the decision.
    await db
      .update(s.reviewItems)
      .set(
        action === "pending_decision"
          ? { status: "pending", decidedBy: null, decidedAt: null }
          : { status: "change_approved", suggestedValue: action === "gone_410" ? "410 Gone" : `301 to ${target}`, decidedBy: user.id, decidedAt: new Date() },
      )
      .where(eq(s.reviewItems.reviewKey, `D4:${u.oldPath}`));
    await audit(user.id, "url_decision", "legacy_url", id, `${u.oldPathDecoded}: ${action}${target ? ` ${target}` : ""}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(back, errorMessage(e));
  }
  done(back, "Saved.");
}

/** Only return to an admin page on this site (the value comes from the form). */
function safeBack(v: string | null, fallback: string): string {
  return v && v.startsWith("/admin/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

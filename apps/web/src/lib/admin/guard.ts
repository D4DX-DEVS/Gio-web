// Server-side guards for every admin page and Server Action, plus audit logging and flash redirects.
import { redirect } from "next/navigation";
import { schema } from "@gio/db";
import { getAdminUser, type AdminUser, type Role } from "@/lib/auth";
import { getDb } from "@/lib/db";

const RANK: Record<Role, number> = { contributor: 1, editor: 2, admin: 3, owner: 4 };

export function hasRole(user: Pick<AdminUser, "role">, min: Role): boolean {
  return RANK[user.role] >= RANK[min];
}

/**
 * Signed-in active user with at least `min` role. Not signed in: redirect to the login page.
 * Signed in without the role: redirect to the dashboard with an error. Call it at the top of
 * every admin page AND every Server Action / route handler (actions are public endpoints).
 */
export async function requireRole(min: Role = "contributor"): Promise<{ user: AdminUser }> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login/");
  if (!hasRole(user, min)) redirect(`/admin/?error=${encodeURIComponent(`This needs the ${min} role.`)}`);
  return { user };
}

/** Best-effort audit row; never blocks the write it describes. */
export async function audit(userId: string, action: string, entityType: string, entityId: string | number, summary?: string) {
  try {
    await getDb()
      .insert(schema.auditLog)
      .values({ userId, action, entityType, entityId: String(entityId), summary: summary?.slice(0, 500) ?? null });
  } catch (e) {
    console.error("audit_log insert failed", e);
  }
}

/** Redirect with a green flash message (shown by the admin layout). */
export function done(path: string, message: string): never {
  redirect(withParam(path, "ok", message));
}

/** Redirect with a red flash message. */
export function fail(path: string, message: string): never {
  redirect(withParam(path, "error", message));
}

/**
 * Adds the flash param, keeping any #fragment at the end. `n` makes every redirect URL unique,
 * so the same message twice in a row (two items added) still shows the second time.
 */
function withParam(path: string, key: string, value: string) {
  const [base, hash] = path.split("#", 2);
  return `${base}${base.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}&n=${Date.now().toString(36)}${hash ? `#${hash}` : ""}`;
}

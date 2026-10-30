"use server";
import { and, eq, max } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { bool, errorMessage, FormError, int, isRedirect, oneOf, req, str } from "@/lib/admin/form";

const SCOPES = ["state", "district", "former"] as const;
const list = (scope: string) => `/admin/leaders/?scope=${scope}`;

function linkOrNull(fd: FormData, name: string): string | null {
  const v = str(fd, name);
  if (v === null) return null;
  if (!/^https?:\/\//i.test(v)) throw new FormError(`${name === "facebookUrl" ? "Facebook" : "Instagram"} link must start with https://`);
  return v;
}

function leaderValues(fd: FormData) {
  return {
    groupId: int(fd, "groupId") ?? (() => { throw new FormError("Choose a group."); })(),
    name: req(fd, "name", "Name"),
    roleTitle: str(fd, "roleTitle"),
    district: str(fd, "district"),
    description: str(fd, "description"),
    photoMediaId: int(fd, "photoMediaId"),
    facebookUrl: linkOrNull(fd, "facebookUrl"),
    instagramUrl: linkOrNull(fd, "instagramUrl"),
    sort: int(fd, "sort") ?? 0,
    isVisible: bool(fd, "isVisible"),
  };
}

async function scopeOfGroup(groupId: number) {
  const [g] = await getDb().select({ scope: s.leaderGroups.scope }).from(s.leaderGroups).where(eq(s.leaderGroups.id, groupId));
  return g?.scope ?? "state";
}

export async function createLeader(fd: FormData) {
  const { user } = await requireRole("editor");
  let id = 0;
  let scope = "state";
  try {
    const v = leaderValues(fd);
    scope = await scopeOfGroup(v.groupId);
    const [{ m }] = await getDb().select({ m: max(s.leaders.sort) }).from(s.leaders).where(eq(s.leaders.groupId, v.groupId));
    const [row] = await getDb()
      .insert(s.leaders)
      .values({ ...v, sort: v.sort || (m ?? 0) + 1, legacySourceUrl: "admin", source: "manual" })
      .returning({ id: s.leaders.id });
    id = row.id;
    await audit(user.id, "create", "leader", id, v.name);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/leaders/new/?group=${str(fd, "groupId") ?? ""}`, errorMessage(e));
  }
  done(list(scope), "Person added.");
}

export async function updateLeader(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  if (!id) fail("/admin/leaders/", "Missing id.");
  try {
    const v = leaderValues(fd);
    await getDb().update(s.leaders).set({ ...v, updatedAt: new Date() }).where(eq(s.leaders.id, id));
    await audit(user.id, "update", "leader", id, v.name);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/leaders/${id}/`, errorMessage(e));
  }
  done(`/admin/leaders/${id}/`, "Saved.");
}

export async function deleteLeader(fd: FormData) {
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  if (!id) fail("/admin/leaders/", "Missing id.");
  let scope = "state";
  try {
    const db = getDb();
    const [l] = await db.select().from(s.leaders).where(eq(s.leaders.id, id));
    if (!l) throw new FormError("Not found.");
    scope = await scopeOfGroup(l.groupId);
    await db.delete(s.mediaUsage).where(and(eq(s.mediaUsage.entityType, "leader"), eq(s.mediaUsage.entityId, String(id))));
    await db.delete(s.leaders).where(eq(s.leaders.id, id));
    await audit(user.id, "delete", "leader", id, l.name);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(`/admin/leaders/${id}/`, errorMessage(e));
  }
  done(list(scope), "Deleted.");
}

export async function saveGroup(fd: FormData) {
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  const scope = oneOf(fd, "scope", SCOPES, "state");
  try {
    if (!id) throw new FormError("Missing id.");
    const heading = str(fd, "heading");
    await getDb()
      .update(s.leaderGroups)
      .set({ heading, termLabel: scope === "former" ? heading : null, sort: int(fd, "sort") ?? 0, isVisible: bool(fd, "isVisible"), updatedAt: new Date() })
      .where(eq(s.leaderGroups.id, id));
    await audit(user.id, "update", "leader_group", id, heading ?? "");
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(list(scope), errorMessage(e));
  }
  done(list(scope), "Group saved.");
}

export async function createGroup(fd: FormData) {
  const { user } = await requireRole("editor");
  const scope = oneOf(fd, "scope", SCOPES, "state");
  try {
    const heading = str(fd, "heading");
    if (scope === "former" && !heading) throw new FormError("Enter the term.");
    const db = getDb();
    const [{ m }] = await db.select({ m: max(s.leaderGroups.sort) }).from(s.leaderGroups).where(eq(s.leaderGroups.scope, scope));
    const [row] = await db
      .insert(s.leaderGroups)
      .values({ scope, heading, termLabel: scope === "former" ? heading : null, sort: (m ?? 0) + 1, source: "manual" })
      .returning({ id: s.leaderGroups.id });
    await audit(user.id, "create", "leader_group", row.id, heading ?? scope);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(list(scope), errorMessage(e));
  }
  done(list(scope), "Group added.");
}

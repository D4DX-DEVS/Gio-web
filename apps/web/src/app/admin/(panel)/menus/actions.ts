"use server";
import { eq, max } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { bool, errorMessage, FormError, int, isRedirect, req, str } from "@/lib/admin/form";

const BACK = "/admin/menus/";

function url(fd: FormData): string | null {
  const v = str(fd, "url");
  if (v === null) return null;
  if (!/^(https?:\/\/|\/|mailto:|tel:)/i.test(v)) throw new FormError("Links must start with / (a page on this site) or https://");
  return v;
}

export async function saveItem(fd: FormData) {
  const { user } = await requireRole("admin");
  try {
    const id = int(fd, "id");
    if (!id) throw new FormError("Missing id.");
    await getDb()
      .update(s.menuItems)
      .set({
        label: req(fd, "label", "Label"),
        url: url(fd),
        icon: str(fd, "icon"),
        sort: int(fd, "sort") ?? 0,
        isVisible: bool(fd, "isVisible"),
        openInNewTab: bool(fd, "openInNewTab"),
        parentId: int(fd, "parentId"),
        updatedAt: new Date(),
      })
      .where(eq(s.menuItems.id, id));
    await audit(user.id, "update", "menu_item", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(BACK, errorMessage(e));
  }
  done(BACK, "Menu saved.");
}

export async function addItem(fd: FormData) {
  const { user } = await requireRole("admin");
  try {
    const menuId = int(fd, "menuId");
    if (!menuId) throw new FormError("Missing menu.");
    const parentId = int(fd, "parentId");
    const db = getDb();
    const [{ m }] = await db.select({ m: max(s.menuItems.sort) }).from(s.menuItems).where(eq(s.menuItems.menuId, menuId));
    const [row] = await db
      .insert(s.menuItems)
      .values({ menuId, parentId, label: req(fd, "label", "Label"), url: url(fd), icon: str(fd, "icon"), sort: (m ?? 0) + 1, openInNewTab: bool(fd, "openInNewTab"), source: "manual" })
      .returning({ id: s.menuItems.id });
    await audit(user.id, "create", "menu_item", row.id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(BACK, errorMessage(e));
  }
  done(BACK, "Menu item added.");
}

export async function deleteItem(fd: FormData) {
  const { user } = await requireRole("admin");
  try {
    const id = int(fd, "id");
    if (!id) throw new FormError("Missing id.");
    const db = getDb();
    await db.delete(s.menuItems).where(eq(s.menuItems.parentId, id));
    await db.delete(s.menuItems).where(eq(s.menuItems.id, id));
    await audit(user.id, "delete", "menu_item", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail(BACK, errorMessage(e));
  }
  done(BACK, "Menu item deleted.");
}

import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/admin/guard";
import { ConfirmButton, SubmitButton } from "@/lib/admin/client";
import { Card, Field, PageHeader } from "@/lib/admin/ui";
import { addItem, deleteItem, saveItem } from "./actions";

export const metadata: Metadata = { title: "Menus" };

type Item = typeof s.menuItems.$inferSelect;

function ItemRow({ item, parents, indent }: { item: Item; parents: Item[]; indent?: boolean }) {
  return (
    <form action={saveItem} className={`grid items-end gap-2 border-b border-line py-3 last:border-0 md:grid-cols-[1.5fr_2fr_1fr_5rem_auto] ${indent ? "md:pl-8" : ""}`}>
      <input type="hidden" name="id" value={item.id} />
      <Field label={indent ? "↳ Label" : "Label"}>
        <input name="label" className="field" defaultValue={item.label} required />
      </Field>
      <Field label="Link" hint={item.url ? undefined : "Empty = dropdown heading"}>
        <input name="url" className="field" defaultValue={item.url ?? ""} placeholder="/about-us/" />
      </Field>
      <Field label="Inside">
        <select name="parentId" className="field" defaultValue={item.parentId ?? ""}>
          <option value="">Top level</option>
          {parents
            .filter((p) => p.id !== item.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Order">
        <input name="sort" type="number" className="field" defaultValue={item.sort} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 pb-1">
        <input type="hidden" name="icon" value={item.icon ?? ""} />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="isVisible" defaultChecked={item.isVisible} /> Show
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" name="openInNewTab" defaultChecked={item.openInNewTab} /> New tab
        </label>
        <SubmitButton className="btn btn-ghost py-1">Save</SubmitButton>
        <ConfirmButton formAction={deleteItem} className="btn btn-danger py-1" message={`Delete "${item.label}"${parents.length ? " and anything inside it" : ""}?`} />
      </div>
    </form>
  );
}

export default async function MenusPage() {
  await requireRole("admin");
  const db = getDb();
  const [menus, items] = await Promise.all([db.select().from(s.menus), db.select().from(s.menuItems).orderBy(asc(s.menuItems.sort), asc(s.menuItems.id))]);
  return (
    <>
      <PageHeader title="Menus" description="The header menu and the social links shown on every page. Changes appear on the website immediately." />
      <div className="space-y-6">
        {menus.map((m) => {
          const mine = items.filter((i) => i.menuId === m.id);
          const top = mine.filter((i) => i.parentId === null);
          return (
            <Card key={m.id} title={m.label}>
              {top.map((t) => (
                <div key={t.id}>
                  <ItemRow item={t} parents={top} />
                  {mine
                    .filter((c) => c.parentId === t.id)
                    .map((c) => (
                      <ItemRow key={c.id} item={c} parents={top} indent />
                    ))}
                </div>
              ))}
              <form action={addItem} className="mt-4 grid items-end gap-2 rounded-lg bg-paper p-3 md:grid-cols-[1.5fr_2fr_1fr_auto]">
                <input type="hidden" name="menuId" value={m.id} />
                <Field label="New item label">
                  <input name="label" className="field" required />
                </Field>
                <Field label="Link">
                  <input name="url" className="field" placeholder={m.key === "social" ? "https://…" : "/page/"} />
                </Field>
                <Field label="Inside">
                  <select name="parentId" className="field" defaultValue="">
                    <option value="">Top level</option>
                    {top.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {m.key === "social" ? (
                  <Field label="Icon">
                    <select name="icon" className="field">
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="x">X</option>
                      <option value="youtube">YouTube</option>
                    </select>
                  </Field>
                ) : null}
                <SubmitButton>Add</SubmitButton>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}

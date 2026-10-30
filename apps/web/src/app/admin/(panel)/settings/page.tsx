import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, requireRole } from "@/lib/admin/guard";
import { errorMessage, int, isRedirect, str } from "@/lib/admin/form";
import { mediaPreviews } from "@/lib/admin/media-options";
import { MediaPicker, SubmitButton } from "@/lib/admin/client";
import { Card, Field, PageHeader } from "@/lib/admin/ui";

export const metadata: Metadata = { title: "Site settings" };

const TEXT_SETTINGS = [
  { key: "site_name", label: "Site name" },
  { key: "tagline", label: "Tagline" },
  { key: "phone", label: "Office phone" },
  { key: "email", label: "Office email" },
  { key: "address", label: "Office address", textarea: true },
] as const;

async function saveSettings(fd: FormData) {
  "use server";
  const { user } = await requireRole("admin");
  try {
    const db = getDb();
    const now = new Date();
    const put = async (key: string, value: unknown) => {
      await db
        .insert(s.siteSettings)
        .values({ key, valueJson: JSON.stringify(value), source: "manual", updatedBy: user.id, updatedAt: now })
        .onConflictDoUpdate({ target: s.siteSettings.key, set: { valueJson: JSON.stringify(value), updatedBy: user.id, updatedAt: now } });
    };
    for (const t of TEXT_SETTINGS) await put(t.key, str(fd, t.key));
    await put("logo_media", int(fd, "logo_media"));
    await audit(user.id, "update", "site_settings", "all");
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/settings/", errorMessage(e));
  }
  done("/admin/settings/", "Settings saved. The header and footer use them right away.");
}

export default async function SettingsPage() {
  await requireRole("admin");
  const db = getDb();
  const rows = await db.select().from(s.siteSettings);
  const v = (k: string) => {
    const r = rows.find((x) => x.key === k);
    try {
      return r ? (JSON.parse(r.valueJson) as unknown) : null;
    } catch {
      return null;
    }
  };
  const logo = v("logo_media");
  const previews = await mediaPreviews(db, [typeof logo === "number" ? logo : null]);
  const [contactPage] = await db.select({ id: s.pages.id }).from(s.pages).where(eq(s.pages.slug, "contact-us"));
  return (
    <>
      <PageHeader title="Site settings" description="Shown in the header, footer and contact details across the site." />
      <form action={saveSettings} className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          {TEXT_SETTINGS.map((t) => (
            <Field key={t.key} label={t.label}>
              {"textarea" in t ? (
                <textarea name={t.key} rows={2} className="field" defaultValue={(v(t.key) as string) ?? ""} />
              ) : (
                <input name={t.key} className="field" defaultValue={(v(t.key) as string) ?? ""} />
              )}
            </Field>
          ))}
          {contactPage ? <p className="text-xs text-muted">The Contact Us page has its own copy of these details in its sections (Pages &amp; homepage).</p> : null}
        </Card>
        <div className="space-y-6">
          <Card>
            <MediaPicker name="logo_media" label="Logo" defaultId={typeof logo === "number" ? logo : null} preview={typeof logo === "number" ? previews.get(logo) : undefined} />
          </Card>
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </form>
    </>
  );
}

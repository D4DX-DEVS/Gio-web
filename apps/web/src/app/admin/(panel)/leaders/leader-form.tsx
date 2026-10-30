import { asc } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { mediaPreviews } from "@/lib/admin/media-options";
import { ConfirmButton, MediaPicker, SubmitButton } from "@/lib/admin/client";
import { Card, Field } from "@/lib/admin/ui";
import { createLeader, deleteLeader, updateLeader } from "./actions";

type Leader = typeof s.leaders.$inferSelect;

const SCOPE_LABEL = { state: "State", district: "District", former: "Former" } as const;

export async function LeaderForm({ leader, groupId, canDelete }: { leader?: Leader; groupId?: number; canDelete?: boolean }) {
  const db = getDb();
  const [groups, previews] = await Promise.all([
    db.select().from(s.leaderGroups).orderBy(asc(s.leaderGroups.scope), asc(s.leaderGroups.sort)),
    mediaPreviews(db, [leader?.photoMediaId]),
  ]);
  const current = leader?.groupId ?? groupId;
  return (
    <form action={leader ? updateLeader : createLeader} className="grid gap-6 lg:grid-cols-3">
      {leader ? <input type="hidden" name="id" value={leader.id} /> : null}
      <Card className="space-y-4 lg:col-span-2">
        <Field label="Name" hint="Exactly as it should appear, including capital letters.">
          <input name="name" className="field" required defaultValue={leader?.name ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role / position">
            <input name="roleTitle" className="field" defaultValue={leader?.roleTitle ?? ""} placeholder="President" />
          </Field>
          <Field label="District / unit" hint="District leaders only.">
            <input name="district" className="field" defaultValue={leader?.district ?? ""} />
          </Field>
        </div>
        <Field label="Description / term">
          <input name="description" className="field" defaultValue={leader?.description ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facebook link">
            <input name="facebookUrl" type="url" className="field" defaultValue={leader?.facebookUrl ?? ""} placeholder="https://www.facebook.com/…" />
          </Field>
          <Field label="Instagram link">
            <input name="instagramUrl" type="url" className="field" defaultValue={leader?.instagramUrl ?? ""} placeholder="https://www.instagram.com/…" />
          </Field>
        </div>
      </Card>
      <div className="space-y-6">
        <Card className="space-y-4">
          <MediaPicker name="photoMediaId" label="Photo" defaultId={leader?.photoMediaId} preview={leader?.photoMediaId ? previews.get(leader.photoMediaId) : undefined} />
          <Field label="Group">
            <select name="groupId" className="field" defaultValue={current ?? ""} required>
              <option value="">Choose…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {SCOPE_LABEL[g.scope]}: {g.heading ?? "(no heading)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order in group" hint="Lower numbers come first. Empty = at the end.">
            <input name="sort" type="number" className="field" defaultValue={leader?.sort ?? ""} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isVisible" defaultChecked={leader?.isVisible ?? true} /> Show on the website
          </label>
        </Card>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>{leader ? "Save" : "Add person"}</SubmitButton>
          {leader && canDelete ? <ConfirmButton formAction={deleteLeader} message={`Delete ${leader.name}? This cannot be undone.`} /> : null}
        </div>
      </div>
    </form>
  );
}

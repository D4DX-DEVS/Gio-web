import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { mediaUrl } from "@/lib/admin/media-options";
import { getDb } from "@/lib/db";
import { requireRole, hasRole } from "@/lib/admin/guard";
import { Badge, Card, EmptyRow, Field, PageHeader, param, Table } from "@/lib/admin/ui";
import { SubmitButton } from "@/lib/admin/client";
import { createGroup, saveGroup } from "./actions";

export const metadata: Metadata = { title: "Leaders" };

const SCOPES = [
  { key: "state", label: "State leaders", page: "/team/" },
  { key: "district", label: "District leaders", page: "/district-leaders/" },
  { key: "former", label: "Former leaders", page: "/former-leaders/" },
] as const;

export default async function LeadersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireRole("contributor");
  const sp = await searchParams;
  const scope = SCOPES.find((x) => x.key === param(sp, "scope")) ?? SCOPES[0];
  const db = getDb();
  const groups = await db.select().from(s.leaderGroups).where(eq(s.leaderGroups.scope, scope.key)).orderBy(asc(s.leaderGroups.sort), asc(s.leaderGroups.id));
  const people = groups.length
    ? await db
        .select({ l: s.leaders, key: s.media.r2Key })
        .from(s.leaders)
        .leftJoin(s.media, eq(s.media.id, s.leaders.photoMediaId))
        .where(inArray(s.leaders.groupId, groups.map((g) => g.id)))
        .orderBy(asc(s.leaders.sort), asc(s.leaders.id))
    : [];
  const canEdit = hasRole(user, "editor");

  return (
    <>
      <PageHeader
        title="Leaders"
        description={
          <>
            Names, roles and links are shown exactly as entered. Entries flagged <Badge value="pending_client" /> are waiting for the client in the review queue.
          </>
        }
        actions={
          <Link href={scope.page} target="_blank" className="btn btn-ghost">
            View page ↗
          </Link>
        }
      />
      <nav className="mb-5 flex flex-wrap gap-2">
        {SCOPES.map((x) => (
          <Link key={x.key} href={`/admin/leaders/?scope=${x.key}`} className={`btn ${x.key === scope.key ? "btn-primary" : "btn-ghost"}`}>
            {x.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-6">
        {groups.map((g) => {
          const members = people.filter((p) => p.l.groupId === g.id);
          return (
            <Card key={g.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                {canEdit ? (
                  <form action={saveGroup} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="scope" value={scope.key} />
                    <Field label={scope.key === "former" ? "Term (as shown)" : "Heading (optional)"}>
                      <input name="heading" className="field" defaultValue={g.heading ?? ""} placeholder={scope.label} />
                    </Field>
                    <Field label="Order" className="w-24">
                      <input name="sort" type="number" className="field" defaultValue={g.sort} />
                    </Field>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input type="checkbox" name="isVisible" defaultChecked={g.isVisible} /> Visible
                    </label>
                    <SubmitButton className="btn btn-ghost">Save group</SubmitButton>
                  </form>
                ) : (
                  <h2 className="text-lg font-semibold text-brand-900">{g.heading ?? scope.label}</h2>
                )}
                {canEdit ? (
                  <Link href={`/admin/leaders/new/?group=${g.id}`} className="btn btn-primary">
                    + Add person
                  </Link>
                ) : null}
              </div>
              <Table>
                <thead>
                  <tr>
                    <th className="w-16">Photo</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th className="w-16">Order</th>
                    <th>Status</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {members.map(({ l, key }) => (
                    <tr key={l.id}>
                      <td>
                        {key ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(key)} alt="" className="h-12 w-12 rounded-full object-cover" loading="lazy" />
                        ) : (
                          <span className="inline-block h-12 w-12 rounded-full bg-paper" />
                        )}
                      </td>
                      <td className="font-medium">{l.name}</td>
                      <td className="text-muted">{l.roleTitle}</td>
                      <td>{l.sort}</td>
                      <td className="space-x-1">
                        {!l.isVisible ? <Badge value="hidden" /> : null}
                        {l.reviewState !== "verified" ? <Badge value={l.reviewState} /> : null}
                      </td>
                      <td>
                        <Link href={`/admin/leaders/${l.id}/`} className="text-brand-700 hover:underline">
                          {canEdit ? "Edit" : "View"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 ? <EmptyRow colSpan={6} /> : null}
                </tbody>
              </Table>
            </Card>
          );
        })}
        {groups.length === 0 ? <Card>No groups yet.</Card> : null}

        {canEdit ? (
          <Card title={scope.key === "former" ? "Add a term" : "Add a group"}>
            <form action={createGroup} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="scope" value={scope.key} />
              <Field label={scope.key === "former" ? "Term, e.g. 2027 - 2028" : "Heading"}>
                <input name="heading" className="field" required={scope.key === "former"} />
              </Field>
              <SubmitButton>Add</SubmitButton>
            </form>
          </Card>
        ) : null}
      </div>
    </>
  );
}

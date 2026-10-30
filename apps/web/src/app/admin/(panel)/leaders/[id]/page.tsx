import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { Badge, Card, PageHeader } from "@/lib/admin/ui";
import { LeaderForm } from "../leader-form";

export const metadata: Metadata = { title: "Edit leader" };

export default async function EditLeader({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("contributor");
  const id = Number((await params).id);
  const db = getDb();
  const [leader] = Number.isInteger(id) ? await db.select().from(s.leaders).where(eq(s.leaders.id, id)) : [];
  if (!leader) notFound();
  const reviews = await db
    .select()
    .from(s.reviewItems)
    .where(and(eq(s.reviewItems.entityType, "leader"), eq(s.reviewItems.entityId, String(id))));
  return (
    <>
      <PageHeader
        title={leader.name}
        description={`Imported from ${leader.legacySourceUrl}`}
        actions={
          <Link href="/admin/leaders/" className="btn btn-ghost">
            ← All leaders
          </Link>
        }
      />
      {reviews.length ? (
        <Card title="Waiting for the client" className="mb-6 border-amber-200 bg-amber-50/50">
          <ul className="space-y-2 text-sm">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Badge value={r.status} /> <span>{r.title}</span>
                <Link className="text-brand-700 hover:underline" href={`/admin/review/?code=${r.code}`}>
                  Open in review queue
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {hasRole(user, "editor") ? <LeaderForm leader={leader} canDelete={hasRole(user, "admin")} /> : <Card>You can view leaders. Editing needs the editor role.</Card>}
    </>
  );
}

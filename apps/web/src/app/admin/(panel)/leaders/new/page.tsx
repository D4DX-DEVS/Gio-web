import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/admin/guard";
import { PageHeader, param } from "@/lib/admin/ui";
import { LeaderForm } from "../leader-form";

export const metadata: Metadata = { title: "Add leader" };

export default async function NewLeader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("editor");
  const group = Number(param(await searchParams, "group"));
  return (
    <>
      <PageHeader
        title="Add a person"
        actions={
          <Link href="/admin/leaders/" className="btn btn-ghost">
            ← All leaders
          </Link>
        }
      />
      <LeaderForm groupId={Number.isInteger(group) ? group : undefined} />
    </>
  );
}

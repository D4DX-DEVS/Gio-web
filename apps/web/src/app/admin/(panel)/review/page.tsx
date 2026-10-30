import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, type SQL } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { hasRole, requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";
import { SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader, Pagination, pageParam, param } from "@/lib/admin/ui";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Review queue" };

const CODES: Record<string, string> = {
  Q1: "Post without a title",
  Q2: "Possibly back-dated posts",
  Q3: "Social links shared by different people",
  Q4: "Name spellings / same photo, different names",
  Q10: "Empty leader slots",
  Q11: "Homepage slides and logos without links",
  Q12: "Leader photos to confirm",
  ALT: "Images without alt text",
  C6: "Unused files and unlinked PDFs",
  C17: "Exposed Google Maps key",
  D4: "Old theme-demo URLs: redirect or remove",
  D4a: "Old author-archive URLs",
};

const PAGE_SIZE = 20;

function entityLink(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "leader") return `/admin/leaders/${id}/`;
  if (type === "post") return `/admin/posts/${id}/`;
  if (type === "event") return `/admin/events/${id}/`;
  if (type === "legacy_url") return `/admin/urls/?q=${encodeURIComponent(id)}`;
  if (type === "section") return "/admin/pages/";
  return null;
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireRole("contributor");
  const sp = await searchParams;
  const code = param(sp, "code");
  const status = param(sp, "status") ?? "pending";
  const page = pageParam(sp);
  const db = getDb();
  const r = s.reviewItems;
  const where: SQL[] = [];
  if (code) where.push(eq(r.code, code));
  if (status !== "all") where.push(eq(r.status, status as "pending"));
  const cond = where.length ? and(...where) : undefined;
  const [items, [{ total }], summary] = await Promise.all([
    db.select().from(r).where(cond).orderBy(asc(r.code), asc(r.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(r).where(cond),
    db.select({ code: r.code, status: r.status, n: count() }).from(r).groupBy(r.code, r.status),
  ]);
  const canDecide = hasRole(user, "admin");
  const codes = [...new Set(summary.map((x) => x.code))].sort();
  const pendingOf = (c: string) => summary.filter((x) => x.code === c && x.status === "pending").reduce((a, x) => a + x.n, 0);
  const back = `/admin/review/?${new URLSearchParams({ ...(code ? { code } : {}), status, ...(page > 1 ? { page: String(page) } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Questions for the client. Everything was imported exactly as published on the old site. Nothing changes until someone with authority decides. Corrections must come from the client; the system never guesses them."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/admin/review/?status=${status}`} className={`btn ${!code ? "btn-primary" : "btn-ghost"}`}>
          All
        </Link>
        {codes.map((c) => (
          <Link key={c} href={`/admin/review/?code=${c}&status=${status}`} className={`btn ${code === c ? "btn-primary" : "btn-ghost"}`} title={CODES[c]}>
            {c} <span className="text-xs opacity-75">({pendingOf(c)})</span>
          </Link>
        ))}
      </div>
      <div className="mb-5 flex gap-2 text-sm">
        {["pending", "keep_as_is", "change_approved", "rejected", "all"].map((st) => (
          <Link key={st} href={`/admin/review/?${new URLSearchParams({ ...(code ? { code } : {}), status: st })}`} className={`rounded-full px-3 py-1 ${status === st ? "bg-brand-600 text-white" : "bg-white text-muted ring-1 ring-line"}`}>
            {st.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      {code && CODES[code] ? <p className="mb-4 font-medium text-brand-900">{CODES[code]}</p> : null}

      <div className="space-y-4">
        {items.map((it) => {
          const link = entityLink(it.entityType, it.entityId);
          return (
            <Card key={it.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono font-semibold text-brand-700">{it.code}</span>
                    <Badge value={it.status} />
                    {it.decidedAt ? <span className="text-muted">decided {fmtDate(it.decidedAt, true)}</span> : null}
                  </div>
                  <h3 className="font-medium text-ink">{it.title}</h3>
                  {it.currentValue ? (
                    <p className="mt-2 break-all text-sm">
                      <span className="text-muted">Published value: </span>
                      <code className="rounded bg-paper px-1">{it.currentValue}</code>
                    </p>
                  ) : null}
                  {it.evidence ? <p className="mt-1 break-words text-xs text-muted">Evidence: {it.evidence.length > 400 ? `${it.evidence.slice(0, 400)}…` : it.evidence}</p> : null}
                  {it.suggestedValue ? <p className="mt-1 text-sm">Approved value: <code className="rounded bg-green-50 px-1">{it.suggestedValue}</code></p> : null}
                  {it.decisionNote ? <p className="mt-1 text-sm text-muted">Note: {it.decisionNote}</p> : null}
                </div>
                {link ? (
                  <Link href={link} className="btn btn-ghost shrink-0">
                    Open item
                  </Link>
                ) : null}
              </div>
              {canDecide ? (
                <form action={decide} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="back" value={back} />
                  <Field label="Client decision">
                    <select name="status" className="field" defaultValue={it.status}>
                      <option value="pending">Still waiting</option>
                      <option value="keep_as_is">Keep as published</option>
                      <option value="change_approved">Change approved (enter the new value)</option>
                      <option value="rejected">Not relevant / rejected</option>
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Approved new value" hint="Only what the client gave you.">
                      <input name="suggestedValue" className="field" defaultValue={it.suggestedValue ?? ""} />
                    </Field>
                    <Field label="Note">
                      <input name="note" className="field" defaultValue={it.decisionNote ?? ""} placeholder="Who decided, when" />
                    </Field>
                  </div>
                  <SubmitButton>Save decision</SubmitButton>
                </form>
              ) : null}
            </Card>
          );
        })}
        {items.length === 0 ? <Card>No items match.</Card> : null}
      </div>
      <Pagination basePath="/admin/review/" page={page} pageSize={PAGE_SIZE} total={total} params={{ code, status }} />
    </>
  );
}

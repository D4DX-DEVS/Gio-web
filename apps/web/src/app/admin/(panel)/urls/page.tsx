import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, or, type SQL } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/admin/guard";
import { contains } from "@/lib/admin/sql";
import { SubmitButton } from "@/lib/admin/client";
import { Badge, EmptyRow, PageHeader, Pagination, pageParam, param, Table } from "@/lib/admin/ui";
import { decideUrl } from "./actions";

export const metadata: Metadata = { title: "Legacy URLs" };

const PAGE_SIZE = 40;
const FILTERS = [
  { key: "pending_decision", label: "Waiting for a decision" },
  { key: "decided", label: "Decided (301 / 410)" },
  { key: "same_path", label: "Kept at the same address" },
  { key: "all", label: "All" },
] as const;

export default async function UrlsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === param(sp, "filter"))?.key ?? "pending_decision";
  const q = param(sp, "q")?.trim();
  const page = pageParam(sp);
  const u = s.legacyUrls;
  const where: SQL[] = [];
  if (filter === "pending_decision" || filter === "same_path") where.push(eq(u.action, filter));
  if (filter === "decided") where.push(or(eq(u.action, "redirect_301"), eq(u.action, "gone_410"))!);
  if (q) where.push(or(contains(u.oldPathDecoded, q), contains(u.oldPath, q))!);
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [{ total }], counts] = await Promise.all([
    db.select().from(u).where(cond).orderBy(asc(u.legacyType), asc(u.oldPathDecoded)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(u).where(cond),
    db.select({ action: u.action, n: count() }).from(u).groupBy(u.action),
  ]);
  const n = (a: string) => counts.find((c) => c.action === a)?.n ?? 0;
  const back = `/admin/urls/?${new URLSearchParams({ filter, ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Old website URLs"
        description={`${n("same_path")} old addresses keep working at the same path. ${n("pending_decision")} (mostly theme-demo pages) wait for the client: send each to a page (301) or mark it gone (410). Nothing is redirected until it is decided here.`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/urls/?filter=${f.key}`} className={`btn ${filter === f.key ? "btn-primary" : "btn-ghost"}`}>
            {f.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/urls/">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" className="field" placeholder="Search path" defaultValue={q ?? ""} />
          <button className="btn btn-ghost">Search</button>
        </form>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Old address</th>
            <th>Type</th>
            <th>Now</th>
            <th className="w-[26rem]">Decision</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="max-w-xs break-all font-mono text-xs">
                {r.oldPathDecoded}
                {r.note ? <div className="mt-1 font-sans text-muted">{r.note}</div> : null}
              </td>
              <td className="text-xs text-muted">{r.legacyType}</td>
              <td className="text-xs">
                {r.action === "same_path" ? (
                  <Link href={r.oldPath} target="_blank" className="text-brand-700 hover:underline">
                    same path ↗
                  </Link>
                ) : r.action === "redirect_301" ? (
                  <span>
                    301 → <code>{r.newPath}</code>
                  </span>
                ) : r.action === "gone_410" ? (
                  <Badge value="rejected" label="410 gone" />
                ) : (
                  <Badge value="pending" />
                )}
              </td>
              <td>
                {r.action === "same_path" ? (
                  <span className="text-xs text-muted">No decision needed</span>
                ) : (
                  <form action={decideUrl} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="action" className="field w-auto py-1 text-sm" defaultValue={r.action}>
                      <option value="pending_decision">Waiting</option>
                      <option value="redirect_301">301 to…</option>
                      <option value="gone_410">410 gone</option>
                    </select>
                    <input name="target" className="field w-40 py-1 text-sm" placeholder={r.recommendedTarget ?? "/"} defaultValue={r.newPath ?? ""} />
                    <SubmitButton className="btn btn-ghost py-1">Save</SubmitButton>
                    {r.recommendedTarget && r.action === "pending_decision" ? <span className="w-full text-xs text-muted">Suggested in the audit: {r.recommendedTarget}</span> : null}
                  </form>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <EmptyRow colSpan={4} /> : null}
        </tbody>
      </Table>
      <Pagination basePath="/admin/urls/" page={page} pageSize={PAGE_SIZE} total={total} params={{ filter, q }} />
    </>
  );
}

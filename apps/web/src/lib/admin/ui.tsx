// Server-rendered building blocks for admin pages. Interactive pieces are in ./client.tsx.
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {title ? <h2 className="mb-4 text-lg font-semibold text-brand-900">{title}</h2> : null}
      {children}
    </section>
  );
}

/** Label + control + optional hint. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const BADGE: Record<string, string> = {
  published: "bg-green-50 text-green-700 ring-green-200",
  verified: "bg-green-50 text-green-700 ring-green-200",
  keep_as_is: "bg-green-50 text-green-700 ring-green-200",
  change_approved: "bg-green-50 text-green-700 ring-green-200",
  client_approved: "bg-green-50 text-green-700 ring-green-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  new: "bg-brand-50 text-brand-700 ring-brand-200",
  review: "bg-amber-50 text-amber-800 ring-amber-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  pending_client: "bg-amber-50 text-amber-800 ring-amber-200",
  scheduled: "bg-brand-50 text-brand-700 ring-brand-200",
  cancelled: "bg-red-50 text-accent-700 ring-red-200",
  rejected: "bg-red-50 text-accent-700 ring-red-200",
  spam: "bg-red-50 text-accent-700 ring-red-200",
  hidden: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[value] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {label ?? value.replaceAll("_", " ")}
    </span>
  );
}

/** Table wrapper with consistent styling; pass <thead>/<tbody> as children. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-paper [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted [&_tr]:border-b [&_tr]:border-line [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-paper/60">
        {children}
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children = "Nothing here yet." }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

/** Prev/next links that keep the other query params. `page` is 1-based. */
export function Pagination({ basePath, page, pageSize, total, params = {} }: { basePath: string; page: number; pageSize: number; total: number; params?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {pages} · {total} items
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn btn-ghost" href={href(page - 1)}>
            ← Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="btn btn-ghost" href={href(page + 1)}>
            Next →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Read `?page=` safely from awaited searchParams. */
export function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const n = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** First value of a search param. */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

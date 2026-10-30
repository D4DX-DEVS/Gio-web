import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb } from "@/lib/db";
import { audit, done, fail, hasRole, requireRole } from "@/lib/admin/guard";
import { errorMessage, fmtDate, FormError, int, isRedirect, istDate, oneOf, req, str, toIstInput } from "@/lib/admin/form";
import { ConfirmButton, SubmitButton } from "@/lib/admin/client";
import { Badge, Card, Field, PageHeader, Pagination, pageParam, param } from "@/lib/admin/ui";

export const metadata: Metadata = { title: "Contact inbox" };

const STATUSES = ["new", "read", "archived", "spam"] as const;
const PAGE_SIZE = 20;
/** Same retention as messages sent with the website form (lib/contact-action.ts). */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
/** page_url of messages typed in here (a phone call, a letter, an email to the office). */
const ADDED_HERE = "/admin/inbox/";

/** The editable fields, with the same limits as the website form. Email or phone is required. */
function messageFields(fd: FormData) {
  const name = (str(fd, "name") ?? "").slice(0, 200) || "(not given)";
  const email = (str(fd, "email") ?? "").slice(0, 200);
  const phone = str(fd, "phone")?.slice(0, 40) ?? null;
  const message = req(fd, "message", "Message").slice(0, 5000);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FormError("Enter a valid email address, or leave it empty.");
  if (!email && !phone) throw new FormError("Enter an email address or a phone number.");
  return { name, email, phone, message, status: oneOf(fd, "status", STATUSES, "new") };
}

async function createMessage(fd: FormData) {
  "use server";
  const { user } = await requireRole("editor");
  let status: string = "new";
  try {
    const fields = messageFields(fd);
    status = fields.status;
    const createdAt = istDate(fd, "receivedAt") ?? new Date();
    const [row] = await getDb()
      .insert(s.contactSubmissions)
      .values({ ...fields, pageUrl: ADDED_HERE, createdAt, purgeAfter: new Date(createdAt.getTime() + RETENTION_MS) })
      .returning({ id: s.contactSubmissions.id });
    await audit(user.id, "create", "contact_submission", row.id, fields.name);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/inbox/", errorMessage(e));
  }
  done(`/admin/inbox/?status=${status}`, "Message added.");
}

async function updateMessage(fd: FormData) {
  "use server";
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  let status: string = "new";
  try {
    if (!id) throw new Error("Missing id.");
    const fields = messageFields(fd);
    status = fields.status;
    const createdAt = istDate(fd, "receivedAt");
    await getDb()
      .update(s.contactSubmissions)
      .set({ ...fields, ...(createdAt ? { createdAt } : {}) })
      .where(eq(s.contactSubmissions.id, id));
    await audit(user.id, "update", "contact_submission", id, "edited");
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/inbox/", errorMessage(e));
  }
  done(`/admin/inbox/?status=${status}`, "Message saved.");
}

async function setStatus(fd: FormData) {
  "use server";
  const { user } = await requireRole("editor");
  const id = int(fd, "id");
  try {
    if (!id) throw new Error("Missing id.");
    const status = oneOf(fd, "status", STATUSES, "read");
    await getDb().update(s.contactSubmissions).set({ status }).where(eq(s.contactSubmissions.id, id));
    await audit(user.id, "update", "contact_submission", id, status);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/inbox/", errorMessage(e));
  }
  done("/admin/inbox/", "Updated.");
}

async function remove(fd: FormData) {
  "use server";
  const { user } = await requireRole("admin");
  const id = int(fd, "id");
  try {
    if (!id) throw new Error("Missing id.");
    await getDb().delete(s.contactSubmissions).where(eq(s.contactSubmissions.id, id));
    await audit(user.id, "delete", "contact_submission", id);
  } catch (e) {
    if (isRedirect(e)) throw e;
    fail("/admin/inbox/", errorMessage(e));
  }
  done("/admin/inbox/", "Message deleted.");
}

/** Inputs shared by the add and edit forms. */
function MessageFields({ m }: { m?: typeof s.contactSubmissions.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" className="field" maxLength={200} defaultValue={m?.name ?? ""} />
      </Field>
      <Field label="Received on" hint="India time. Empty means now.">
        <input name="receivedAt" type="datetime-local" className="field" defaultValue={m ? toIstInput(m.createdAt) : ""} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" className="field" maxLength={200} defaultValue={m?.email ?? ""} />
      </Field>
      <Field label="Phone">
        <input name="phone" className="field" maxLength={40} defaultValue={m?.phone ?? ""} />
      </Field>
      <Field label="Message" className="sm:col-span-2">
        <textarea name="message" rows={5} required maxLength={5000} className="field" defaultValue={m?.message ?? ""} />
      </Field>
      <Field label="Status">
        <select name="status" className="field" defaultValue={m?.status ?? "new"}>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireRole("contributor");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(param(sp, "status") ?? "") ? (param(sp, "status") as (typeof STATUSES)[number]) : "new";
  const page = pageParam(sp);
  const c = s.contactSubmissions;
  const db = getDb();
  const [rows, [{ total }], counts] = await Promise.all([
    db.select().from(c).where(eq(c.status, status)).orderBy(desc(c.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(c).where(eq(c.status, status)),
    db.select({ status: c.status, n: count() }).from(c).groupBy(c.status),
  ]);
  const canEdit = hasRole(user, "editor");
  return (
    <>
      <PageHeader title="Contact inbox" description="Messages sent with the form on the Contact Us page, and ones added here. They contain personal data: do not forward them outside the organisation." />
      {canEdit ? (
        <details className="mb-5 rounded-xl border border-line bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-3 font-semibold text-brand-900">+ Add a message</summary>
          <form action={createMessage} className="space-y-4 border-t border-line p-5">
            <p className="text-sm text-muted">For a message that came by phone, letter or email to the office.</p>
            <MessageFields />
            <SubmitButton>Add message</SubmitButton>
          </form>
        </details>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((st) => (
          <Link key={st} href={`/admin/inbox/?status=${st}`} className={`btn ${status === st ? "btn-primary" : "btn-ghost"}`}>
            {st} ({counts.find((x) => x.status === st)?.n ?? 0})
          </Link>
        ))}
      </div>
      <div className="space-y-4">
        {rows.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-muted">
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className="text-brand-700 hover:underline">
                      {m.email}
                    </a>
                  ) : null}
                  {m.email && m.phone ? " · " : ""}
                  {m.phone ?? ""} · {fmtDate(m.createdAt, true)}
                </div>
              </div>
              <div className="flex gap-1">
                {m.pageUrl === ADDED_HERE ? <Badge value="draft" label="added here" /> : null}
                <Badge value={m.status} />
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
            {canEdit ? (
              <>
                <form action={setStatus} className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  <input type="hidden" name="id" value={m.id} />
                  {STATUSES.filter((st) => st !== m.status).map((st) => (
                    <SubmitButton key={st} className="btn btn-ghost py-1" name="status" value={st}>
                      Mark {st}
                    </SubmitButton>
                  ))}
                  {hasRole(user, "admin") ? <ConfirmButton formAction={remove} className="btn btn-danger py-1" message="Delete this message permanently?" /> : null}
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">Edit</summary>
                  <form action={updateMessage} className="mt-3 space-y-4">
                    <input type="hidden" name="id" value={m.id} />
                    <MessageFields m={m} />
                    <SubmitButton>Save message</SubmitButton>
                  </form>
                </details>
              </>
            ) : null}
          </Card>
        ))}
        {rows.length === 0 ? <Card>No {status} messages.</Card> : null}
      </div>
      <Pagination basePath="/admin/inbox/" page={page} pageSize={PAGE_SIZE} total={total} params={{ status }} />
    </>
  );
}

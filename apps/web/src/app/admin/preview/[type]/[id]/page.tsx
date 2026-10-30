// Draft preview for signed-in staff: a page's draft sections, or a post or event in any status,
// rendered with the public site's components. Outside the admin shell so it looks like the site.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { buildPageLayout } from "@gio/db/layout";
import { Img } from "@/components/Img";
import { Sections } from "@/components/Sections";
import { Container } from "@/components/ui";
import { getMedia } from "@/lib/content";
import { getDb } from "@/lib/db";
import { sanitize } from "@/lib/sanitize";
import { langOf } from "@/lib/text";
import { requireRole } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/form";

export const metadata: Metadata = { title: "Draft preview · GIO Admin", robots: { index: false, follow: false } };

function Bar({ label, status, edit }: { label: string; status: string; edit: string }) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow">
      <span>
        Draft preview: {label} · status <strong>{status}</strong>. Visitors do not see this page.
      </span>
      <Link href={edit} className="rounded-full bg-amber-950 px-4 py-1 text-xs font-semibold text-white hover:bg-black">
        ← Back to editing
      </Link>
    </div>
  );
}

export default async function Preview({ params }: { params: Promise<{ type: string; id: string }> }) {
  await requireRole("contributor");
  const { type, id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();

  if (type === "page") {
    const [page] = await db.select().from(s.pages).where(and(eq(s.pages.id, id), isNull(s.pages.deletedAt))).limit(1);
    if (!page) notFound();
    const layout = await buildPageLayout(db, id);
    return (
      <div className="min-h-screen bg-white">
        <Bar label={page.slug === "" ? "Homepage (draft sections)" : page.title} status={page.status} edit={page.slug === "" ? "/admin/homepage/banners/" : `/admin/pages/${id}/`} />
        {page.slug === "" ? (
          <p className="bg-paper px-4 py-2 text-center text-xs text-muted">The live homepage also shows the latest news and events between these sections.</p>
        ) : null}
        {layout.sections.length ? <Sections layout={layout} pageTitle={page.title} /> : <Container className="py-16 text-center text-muted">No visible sections in the draft.</Container>}
      </div>
    );
  }

  if (type === "post" || type === "event") {
    const row =
      type === "post"
        ? (await db.select().from(s.posts).where(and(eq(s.posts.id, id), isNull(s.posts.deletedAt))).limit(1)).map((p) => ({ title: p.title, status: p.status, html: p.bodyHtml, mediaId: p.featuredMediaId, date: p.publishedAt, excerpt: p.excerpt }))[0]
        : (await db.select().from(s.events).where(and(eq(s.events.id, id), isNull(s.events.deletedAt))).limit(1)).map((e) => ({ title: e.title, status: e.status, html: e.descriptionHtml ?? "", mediaId: e.featuredMediaId, date: e.startsAt, excerpt: null }))[0];
    if (!row) notFound();
    const image = await getMedia(row.mediaId);
    const body = sanitize(row.html);
    const title = row.title || "Untitled";
    return (
      <div className="min-h-screen bg-white">
        <Bar label={type === "post" ? "Post" : "Event"} status={row.status} edit={`/admin/${type}s/${id}/`} />
        <article>
          <header className="bg-brand-900 text-white">
            <Container className="max-w-4xl pb-16 pt-10 sm:pb-20 sm:pt-14">
              <h1 lang={langOf(title)} className="font-display text-2xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              <p className="mt-3 text-base text-brand-200">{row.date ? fmtDate(row.date, type === "event") : "No date set"}</p>
            </Container>
          </header>
          <Container className="max-w-4xl py-8 sm:py-12">
            {image ? (
              <figure className="mx-auto -mt-16 mb-8 w-fit overflow-hidden rounded-2xl shadow-xl shadow-brand-900/20 ring-1 ring-line sm:-mt-20">
                <Img media={image} eager className="h-auto max-h-[70vh] w-auto max-w-full" />
              </figure>
            ) : null}
            {row.excerpt ? <p className="mb-6 rounded-lg bg-paper px-4 py-3 text-sm text-muted">Excerpt (used on cards): {row.excerpt}</p> : null}
            {body ? <div lang={langOf(body.slice(0, 400))} className="prose-gio" dangerouslySetInnerHTML={{ __html: body }} /> : <p className="text-muted">No text yet.</p>}
          </Container>
        </article>
      </div>
    );
  }
  notFound();
}

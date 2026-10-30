import type { Metadata } from "next";
import { FileIcon } from "@/components/Icons";
import { Container, EmptyState, PageHero } from "@/components/ui";
import { listDocuments } from "@/lib/content";
import { formatDate, langOf } from "@/lib/text";

export const metadata: Metadata = { title: "Documents & downloads" };

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default async function DocumentsPage() {
  const docs = await listDocuments();
  return (
    <>
      <PageHero title="Documents & downloads" eyebrow="Resources" crumbs={[{ href: "/documents/", label: "Documents" }]} />
      <Container className="max-w-4xl py-10 sm:py-14">
        {docs.length ? (
          <ul className="space-y-4">
            {docs.map((d) => (
              <li key={d.id} data-reveal>
                <a href={d.file!.url} target="_blank" rel="noopener noreferrer" className="card-lift group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:gap-5 sm:p-5">
                  <span className="rounded-xl bg-accent-600/10 p-3 text-accent-600">
                    <FileIcon className="h-7 w-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span lang={langOf(d.title)} className="block font-display text-base font-semibold text-brand-900 transition-colors group-hover:text-brand-600 sm:text-lg">{d.title}</span>
                    <span className="block text-sm text-muted">
                      {d.file!.mimeType === "application/pdf" ? "PDF" : d.file!.mimeType} · {size(d.byteSize)}
                      {d.publishedAt && ` · ${formatDate(d.publishedAt)}`}
                    </span>
                    {d.description && <span className="mt-1 block text-sm text-muted">{d.description}</span>}
                  </span>
                  <span className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-brand-700 sm:inline">Download</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No documents are published yet." />
        )}
      </Container>
    </>
  );
}

import type { Metadata } from "next";
import { FileIcon } from "@/components/Icons";
import { Container, EmptyState, PageHero } from "@/components/ui";
import { listDocuments } from "@/lib/content";
import { formatDate } from "@/lib/text";

export const metadata: Metadata = { title: "Documents & downloads" };

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default async function DocumentsPage() {
  const docs = await listDocuments();
  return (
    <>
      <PageHero title="Documents & downloads" eyebrow="Resources" crumbs={[{ href: "/documents/", label: "Documents" }]} />
      <Container className="max-w-4xl py-8 sm:py-10">
        {docs.length ? (
          <ul className="space-y-3">
            {docs.map((d) => (
              <li key={d.id} className="reveal">
                <a href={d.file!.url} target="_blank" rel="noopener noreferrer" className="card-lift group flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 shadow-card hover:border-brand-300 sm:gap-4 sm:p-4">
                  <span className="rounded-xl bg-accent-600/10 p-2.5 text-accent-600 transition group-hover:scale-110 group-hover:bg-accent-600 group-hover:text-white">
                    <FileIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-semibold text-brand-900 sm:text-[1.0625rem] transition-colors group-hover:text-brand-600">{d.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {d.file!.mimeType === "application/pdf" ? "PDF" : d.file!.mimeType} · {size(d.byteSize)}
                      {d.publishedAt && ` · ${formatDate(d.publishedAt)}`}
                    </span>
                    {d.description && <span className="mt-1 block text-sm text-muted">{d.description}</span>}
                  </span>
                  <span className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-accent-600 sm:inline">Download</span>
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

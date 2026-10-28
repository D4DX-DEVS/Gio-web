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
      <Container className="max-w-4xl py-14">
        {docs.length ? (
          <ul className="space-y-4">
            {docs.map((d) => (
              <li key={d.id}>
                <a href={d.file!.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-5 rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
                  <span className="rounded-xl bg-accent-600/10 p-3 text-accent-600">
                    <FileIcon className="h-7 w-7" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-lg font-semibold text-brand-900 group-hover:text-brand-600">{d.title}</span>
                    <span className="block text-sm text-muted">
                      {d.file!.mimeType === "application/pdf" ? "PDF" : d.file!.mimeType} · {size(d.byteSize)}
                      {d.publishedAt && ` · ${formatDate(d.publishedAt)}`}
                    </span>
                    {d.description && <span className="mt-1 block text-sm text-muted">{d.description}</span>}
                  </span>
                  <span className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white sm:inline">Download</span>
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

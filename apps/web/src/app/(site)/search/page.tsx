import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/Icons";
import { Container, EmptyState, PageHero, PostCard } from "@/components/ui";
import { search } from "@/lib/search";
import { eventHref, formatDate, langOf } from "@/lib/text";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).slice(0, 100);
  const results = q.trim() ? await search(q) : null;
  return (
    <>
      <PageHero title="Search" subtitle="Search news, events, pages and leaders, in Malayalam or English." />
      <Container className="max-w-5xl py-12">
        <form action="/search/" method="get" role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Search the site
          </label>
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input id="q" name="q" type="search" defaultValue={q} placeholder="ഉദാ: ഫലസ്തീൻ, Thibyan, Kannur…" className="field !rounded-full !py-3 !pl-12 text-base" autoFocus={!q} />
          </div>
          <button type="submit" className="btn btn-primary !rounded-full !px-6">
            Search
          </button>
        </form>

        {results && (
          <div className="mt-10 space-y-12">
            <p className="text-sm text-muted">
              {results.total} result{results.total === 1 ? "" : "s"} for <strong lang={langOf(q)} className="text-ink">“{q}”</strong>
            </p>
            {results.total === 0 && <EmptyState title="Nothing matched your search.">Try a shorter word, or the English or Malayalam spelling.</EmptyState>}
            {results.pages.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-bold text-brand-900">Pages</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {results.pages.map((p) => (
                    <li key={p.slug}>
                      <Link href={p.slug ? `/${encodeURIComponent(p.slug)}/` : "/"} className="block rounded-xl border border-line p-4 font-medium hover:border-brand-300 hover:bg-brand-50">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.posts.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-bold text-brand-900">News &amp; stories</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {results.posts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              </section>
            )}
            {results.events.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-bold text-brand-900">Events</h2>
                <ul className="space-y-2">
                  {results.events.map((e) => (
                    <li key={e.slug}>
                      <Link href={eventHref(e.slug)} className="flex justify-between gap-4 rounded-xl border border-line p-4 hover:border-brand-300 hover:bg-brand-50">
                        <span lang={langOf(e.title)} className="font-medium">
                          {e.title}
                        </span>
                        <span className="shrink-0 text-sm text-muted">{formatDate(e.startsAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.leaders.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-bold text-brand-900">Leaders</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {results.leaders.map((l) => (
                    <li key={`${l.scope}-${l.id}`}>
                      <Link href={l.href} className="block rounded-xl border border-line p-4 hover:border-brand-300 hover:bg-brand-50">
                        <span className="block font-semibold text-brand-900">{l.name}</span>
                        <span className="block text-sm text-muted">
                          {[l.role, l.scope === "former" ? l.group : null].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Container>
    </>
  );
}

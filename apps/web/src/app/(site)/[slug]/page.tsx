import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleSkeleton, LoadingRegion, PageHeroSkeleton, PostGridSkeleton } from "@/components/Skeletons";
import { LeadersPage, ListingPage, PostPage, SectionsPage } from "@/components/views";
import { getPublishedPage, getPublishedPost } from "@/lib/content";
import { decodeSlug, stripHtml } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const page = await getPublishedPage(slug);
  if (page) return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined, alternates: { canonical: `/${encodeURIComponent(slug)}/` } };
  const post = await getPublishedPost(slug);
  if (post) {
    const p = post.post;
    return {
      title: p.seoTitle ?? (p.title || "Untitled post"),
      description: p.seoDescription ?? (stripHtml(p.excerpt ?? p.bodyHtml, 160) || undefined),
      alternates: { canonical: `/${encodeURIComponent(slug)}/` },
      openGraph: { type: "article", images: post.card.image ? [post.card.image.url] : undefined, publishedTime: p.publishedAt?.toISOString() },
    };
  }
  return {};
}

// The page or post is looked up before any Suspense boundary, so a missing slug still answers 404.
// The rest of the content then streams in behind a skeleton shaped like the page being opened.
export default async function SlugPage({ params }: PageProps<"/[slug]">) {
  const slug = decodeSlug((await params).slug);
  const page = await getPublishedPage(slug);
  if (page) {
    if (page.template === "leaders") return <Loading grid="cards" view={<LeadersPage page={page} />} />;
    if (page.template === "post_listing") return <Loading grid="posts" view={<ListingPage page={page} pageNo={1} />} />;
    return <Loading view={<SectionsPage page={page} />} />;
  }
  if (await getPublishedPost(slug)) return <Loading view={<PostPage slug={slug} />} />;
  notFound();
}

function Loading({ view, grid }: { view: React.ReactNode; grid?: "posts" | "cards" }) {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Loading the page">
          <PageHeroSkeleton />
          {grid ? <PostGridSkeleton tabs={grid === "posts"} /> : <ArticleSkeleton />}
        </LoadingRegion>
      }
    >
      {view}
    </Suspense>
  );
}

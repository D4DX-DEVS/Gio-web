import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/views";
import { getPublishedPage } from "@/lib/content";
import { decodeSlug, pageNumber } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/[slug]/page/[n]">): Promise<Metadata> {
  const { slug, n } = await params;
  const page = await getPublishedPage(decodeSlug(slug));
  return page ? { title: `${page.title} - Page ${n}` } : {};
}

export default async function ListingPageN({ params }: PageProps<"/[slug]/page/[n]">) {
  const { slug, n } = await params;
  const pageNo = pageNumber(n);
  const page = await getPublishedPage(decodeSlug(slug));
  if (!page || page.template !== "post_listing" || !pageNo) notFound();
  return <ListingPage page={page} pageNo={pageNo} />;
}

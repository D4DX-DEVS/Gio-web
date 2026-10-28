import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostGrid } from "@/components/views";
import { getTag, listPosts } from "@/lib/content";
import { decodeSlug } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/tag/[slug]">): Promise<Metadata> {
  const tag = await getTag(decodeSlug((await params).slug));
  return tag ? { title: tag.name } : {};
}

export default async function TagPage({ params }: PageProps<"/tag/[slug]">) {
  const slug = decodeSlug((await params).slug);
  const tag = await getTag(slug);
  if (!tag) notFound();
  const { items, pages } = await listPosts({ tag: slug }, 1, 30);
  return <PostGrid title={tag.name} eyebrow="Tag" base={`/tag/${encodeURIComponent(slug)}/`} items={items} page={1} pages={pages} />;
}

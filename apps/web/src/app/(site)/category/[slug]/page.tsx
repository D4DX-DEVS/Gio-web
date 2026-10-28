import type { Metadata } from "next";
import { CategoryView } from "@/components/views";
import { getCategory } from "@/lib/content";
import { decodeSlug } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const cat = await getCategory(decodeSlug((await params).slug));
  return cat ? { title: cat.name.replace(/^gio /i, "GIO ") } : {};
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return <CategoryView slug={decodeSlug((await params).slug)} page={1} />;
}

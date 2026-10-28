import { notFound } from "next/navigation";
import { decodeSlug, pageNumber } from "@/lib/text";
import { CategoryView } from "@/components/views";

export default async function CategoryPageN({ params }: PageProps<"/category/[slug]/page/[n]">) {
  const { slug, n } = await params;
  const pageNo = pageNumber(n);
  if (!pageNo) notFound();
  return <CategoryView slug={decodeSlug(slug)} page={pageNo} />;
}

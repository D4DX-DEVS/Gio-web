import { requireRole } from "@/lib/admin/guard";
import { PageHeader } from "@/lib/admin/ui";
import { PostForm } from "../post-form";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  const { user } = await requireRole("contributor");
  return (
    <>
      <PageHeader title="New post" />
      <PostForm user={user} />
    </>
  );
}

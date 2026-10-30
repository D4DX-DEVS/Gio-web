import { getAdminUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listImageOptions } from "@/lib/admin/media-options";

/** Image list for MediaPicker, loaded when its dialog opens. */
export async function GET() {
  if (!(await getAdminUser())) return new Response("Unauthorized", { status: 401 });
  return Response.json(await listImageOptions(getDb()), { headers: { "Cache-Control": "private, no-store" } });
}

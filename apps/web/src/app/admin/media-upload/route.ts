// Multipart upload to R2 (Server Actions have a 1 MB body limit). Images and PDFs only,
// type checked from the bytes. Creates a media row and, for PDFs, a draft document.
//   json=1       answer with JSON instead of a redirect (MediaPicker's "Upload new").
//   kind=image   refuse anything that is not an image.
//   replace=<id> the upload replaces that file: every field that selects it is pointed at the
//                new file (R2 keys never change, so old addresses keep serving the old bytes).
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { schema as s } from "@gio/db";
import { getDb, getEnv } from "@/lib/db";
import { audit, hasRole } from "@/lib/admin/guard";
import { getAdminUser } from "@/lib/auth";
import { dimensions, FOLDERS, LIMITS, newKey, sha256Hex, sniff, type Folder } from "@/lib/admin/files";
import { mediaUrl } from "@/lib/admin/media-options";
import { replaceMediaEverywhere } from "@/lib/admin/usage";

const RETURN_PATHS = ["/admin/media/", "/admin/documents/"];

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  let json = req.nextUrl.searchParams.get("json") === "1";
  const reply = (path: string, key: "ok" | "error", msg: string, extra: Record<string, unknown> = {}, status = 400) =>
    json
      ? NextResponse.json(key === "ok" ? { ok: true, message: msg, ...extra } : { ok: false, error: msg }, { status: key === "ok" ? 200 : status })
      : NextResponse.redirect(new URL(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`, req.url), 303);

  if (!user) return json ? NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 }) : NextResponse.redirect(new URL("/admin/login/", req.url), 303);
  // Same-origin check: a form on another site must not be able to upload with our cookies.
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.nextUrl.host) return reply("/admin/media/", "error", "Upload refused (wrong origin).", {}, 403);

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return reply("/admin/media/", "error", "The upload could not be read. Try again with a smaller file.");
  }
  json ||= fd.get("json") === "1";
  const backRaw = String(fd.get("back") ?? "");
  const replaceId = Number(fd.get("replace") ?? 0) || null;
  const returnTo = replaceId ? `/admin/media/${replaceId}/` : RETURN_PATHS.includes(backRaw) ? backRaw : "/admin/media/";
  if (!hasRole(user, "editor")) return reply(returnTo, "error", "Uploading needs the editor role.", {}, 403);

  const files = fd.getAll("file").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);
  if (!files.length) return reply(returnTo, "error", "Choose a file to upload.");
  if ((json || replaceId) && files.length > 1) return reply(returnTo, "error", "Choose one file.");
  const onlyImages = fd.get("kind") === "image" || req.nextUrl.searchParams.get("kind") === "image";
  const folderRaw = String(fd.get("folder") ?? "images");
  const alt = String(fd.get("alt") ?? "").trim() || null;
  const db = getDb();
  const env = getEnv();

  const old = replaceId ? (await db.select().from(s.media).where(eq(s.media.id, replaceId)))[0] : undefined;
  if (replaceId && (!old || old.deletedAt)) return reply("/admin/media/", "error", "The file to replace no longer exists.", {}, 404);

  // Check every file before storing any, so one bad file in a batch stores nothing.
  const checked: { file: File; bytes: Uint8Array; t: NonNullable<ReturnType<typeof sniff>> }[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t = sniff(bytes);
    if (!t) return reply(returnTo, "error", `${file.name}: only JPEG, PNG, GIF, WebP images and PDF documents can be uploaded.`, {}, 415);
    if (onlyImages && t.kind !== "image") return reply(returnTo, "error", `${file.name} is not an image (JPEG, PNG, GIF or WebP).`, {}, 415);
    if (old && t.kind !== old.kind) return reply(returnTo, "error", `Replace ${old.kind === "image" ? "an image with another image" : "a PDF with another PDF"}.`, {}, 415);
    if (bytes.length > LIMITS[t.kind]) return reply(returnTo, "error", `${file.name} is too large (max ${LIMITS[t.kind] / 1048576} MB).`, {}, 413);
    checked.push({ file, bytes, t });
  }

  const created: { id: number; url: string; name: string; alt: string | null }[] = [];
  for (const { file, bytes, t } of checked) {
    const folder: Folder =
      t.kind === "document" ? "documents" : (FOLDERS as readonly string[]).includes(folderRaw) && folderRaw !== "documents" ? (folderRaw as Folder) : "images";
    const key = newKey(folder, file.name, t.ext);
    const sha = await sha256Hex(bytes);
    const dim = t.kind === "image" ? dimensions(bytes, t.mime) : null;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: t.mime }, customMetadata: { sha256: sha, uploadedBy: user.id } });
    const altText = t.kind === "image" ? (alt ?? old?.altText ?? null) : null;
    const [row] = await db
      .insert(s.media)
      .values({
        r2Key: key,
        kind: t.kind,
        usageHint: old?.usageHint ?? (folder === "images" ? null : folder === "documents" ? "document" : folder.replace(/s$/, "")),
        originalFilename: file.name.slice(0, 200),
        mimeType: t.mime,
        declaredMimeType: file.type || null,
        byteSize: bytes.length,
        width: dim?.width ?? null,
        height: dim?.height ?? null,
        sha256: sha,
        altText,
        title: old?.title ?? file.name.replace(/\.[^.]+$/, ""),
        caption: old?.caption ?? null,
        credit: old?.credit ?? null,
        fileStatus: "available",
        uploadedBy: user.id,
        source: "manual",
      })
      .returning({ id: s.media.id });
    // A PDF uploaded as a replacement takes over the old one's document entry instead (below).
    if (t.kind === "document" && !old) {
      await db.insert(s.documents).values({ mediaId: row.id, title: String(fd.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, ""), status: "draft", source: "manual" });
    }
    await audit(user.id, "upload", "media", row.id, key);
    created.push({ id: row.id, url: mediaUrl(key), name: file.name, alt: altText });
  }

  if (old) {
    const newId = created[0].id;
    if (old.kind === "document") await db.update(s.documents).set({ mediaId: newId, updatedAt: new Date() }).where(eq(s.documents.mediaId, old.id));
    const { pages, fields } = await replaceMediaEverywhere(db, old.id, newId);
    await audit(user.id, "replace", "media", old.id, `replaced by media ${newId} in ${fields} field(s)`);
    const publish = pages.length ? ` Publish ${pages.map((p) => p.title).join(", ")} to show it on the website.` : "";
    return reply(`/admin/media/${newId}/`, "ok", `Replaced in ${fields} place${fields === 1 ? "" : "s"}. The old file is kept at its old address.${publish}`, { media: created[0] });
  }
  if (json) return reply(returnTo, "ok", "Uploaded.", { media: created[0] });
  return reply(returnTo, "ok", `Uploaded ${created.length} file${created.length === 1 ? "" : "s"}.`);
}

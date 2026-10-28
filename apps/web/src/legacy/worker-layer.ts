// Glue between the Worker entry (apps/web/worker.ts) and the pure legacy modules.
// Returns a Response for legacy URLs, or null to let OpenNext/Next.js handle the request.
import { LEGACY_MEDIA_DATA } from "./generated/legacy-media-data.ts";
import { LEGACY_URL_DATA } from "./generated/legacy-url-data.ts";
import { buildLookups, type LegacyLookups } from "./lookups.ts";
import { handleLegacyMedia, type MediaContext } from "./media-handler.ts";
import { buildMediaIndex, type MediaIndex } from "./media-plan.ts";
import { resolveLegacyRequest } from "./resolve-request.ts";

export const CACHE_REDIRECT = "public, max-age=3600";
export const CACHE_GONE = "public, max-age=86400";

let lookups: LegacyLookups | undefined;
let mediaIndex: MediaIndex | undefined;

export async function handleLegacyRequest(request: Request, media: MediaContext): Promise<Response | null> {
  lookups ??= buildLookups(LEGACY_URL_DATA);
  const resolution = resolveLegacyRequest(request, lookups);
  switch (resolution.kind) {
    case "media":
      mediaIndex ??= buildMediaIndex(LEGACY_MEDIA_DATA);
      return handleLegacyMedia(request, resolution.key, mediaIndex, media);
    case "redirect":
      return new Response(null, {
        status: resolution.status,
        headers: { Location: resolution.location, "Cache-Control": CACHE_REDIRECT, "X-Legacy-Rule": resolution.rule },
      });
    case "gone":
      return new Response(request.method === "HEAD" ? null : "Gone", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": CACHE_GONE, "X-Legacy-Rule": resolution.rule },
      });
    case "pass":
      return null;
  }
}

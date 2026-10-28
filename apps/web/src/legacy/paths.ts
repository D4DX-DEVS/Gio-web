// Path helpers shared by the redirect resolver and the media handler. Pure functions.

export const UPLOADS_PREFIX = "/wp-content/uploads/";

/** decodeURIComponent that returns null instead of throwing on malformed escapes. */
export function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Percent-encodes a decoded site path the way WordPress does: each segment is
 * UTF-8 percent-encoded with lowercase hex, "/" is kept. No Unicode
 * normalisation is applied (05-MIGRATION-DESIGN.md §6.1 rule 5).
 */
export function encodeLegacyPath(decodedPath: string): string {
  return decodedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()))
    .join("/");
}

/** A redirect target must be a site-relative path: no scheme, host, backslash or "//". */
export function isSafeSitePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !/[\u0000-\u001f]/.test(path);
}

/**
 * Turns "/wp-content/uploads/<segments>" into the R2 key "wp-content/uploads/<decoded segments>".
 * Returns null for anything that could escape the prefix or is not a plain file path.
 */
export function uploadKeyFromPathname(pathname: string): string | null {
  if (!pathname.startsWith(UPLOADS_PREFIX)) return null;
  const rest = pathname.slice(UPLOADS_PREFIX.length);
  if (!rest || rest.endsWith("/")) return null;
  const segments: string[] = [];
  for (const raw of rest.split("/")) {
    const s = safeDecode(raw);
    if (s === null || s === "" || s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\u0000-\u001f]/.test(s)) {
      return null;
    }
    segments.push(s);
  }
  const key = "wp-content/uploads/" + segments.join("/");
  return key.length <= 1024 ? key : null;
}

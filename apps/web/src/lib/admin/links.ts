// Link checks for admin input. Kept free of imports so node --test can load it directly.

/**
 * A link an editor may put on the website: a path on this site, https/http, mailto: or tel:.
 * Anything else (javascript:, data:, protocol-relative //host) is refused. Returns the trimmed
 * value, null for empty input, or throws with a message for the editor.
 */
export function safeLink(raw: string | null | undefined): string | null {
  const v = raw?.trim() ?? "";
  if (!v) return null;
  if (/^\/(?!\/)/.test(v) || /^#/.test(v)) return v;
  if (/^(mailto|tel):[^\s]+$/i.test(v)) return v;
  if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v)) {
    try {
      new URL(v);
      return v;
    } catch {
      // fall through
    }
  }
  throw new LinkError("Links must start with / (a page on this site), https://, mailto: or tel:.");
}

export class LinkError extends Error {}

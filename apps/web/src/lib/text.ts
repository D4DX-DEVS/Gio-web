// Small text helpers shared by public pages.

const MALAYALAM = /[ഀ-ൿ]/;

/** "ml" when the text contains Malayalam script, so browsers pick the right font and line breaking. */
export function langOf(text: string | null | undefined): "ml" | "en" {
  return text && MALAYALAM.test(text) ? "ml" : "en";
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" });
const monFmt = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" });

export const formatDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "");
export const formatTime = (d: Date | null | undefined) => (d ? timeFmt.format(d) : "");
export const dayOf = (d: Date) => dayFmt.format(d);
export const monthOf = (d: Date) => monFmt.format(d);

/** Plain-text summary of HTML for cards and meta descriptions. */
export function stripHtml(html: string | null | undefined, max = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd() + "…";
}

/** Route params may arrive percent-encoded (Malayalam slugs); slugs are stored decoded. */
export function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export const postHref = (slug: string) => `/${encodeURIComponent(slug)}/`;
export const eventHref = (slug: string) => `/event/${encodeURIComponent(slug)}/`;

export function pageNumber(raw: string | undefined): number | null {
  if (raw === undefined) return 1;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

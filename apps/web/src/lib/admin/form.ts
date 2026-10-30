// FormData readers and date helpers shared by admin Server Actions.
// Dates are entered and shown in India time (the site's only timezone).
import { safeLink } from "./links";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Trimmed string, or null when empty/missing. */
export function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Required trimmed string; throws a user-facing message when empty. */
export function req(fd: FormData, name: string, label = name): string {
  const v = str(fd, name);
  if (v === null) throw new FormError(`${label} is required.`);
  return v;
}

export function int(fd: FormData, name: string): number | null {
  const v = str(fd, name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** Checkbox: present = true. */
export function bool(fd: FormData, name: string): boolean {
  return fd.get(name) !== null && fd.get(name) !== "0" && fd.get(name) !== "false";
}

/** One of the allowed values, else the fallback. */
export function oneOf<T extends string>(fd: FormData, name: string, allowed: readonly T[], fallback: T): T {
  const v = str(fd, name);
  return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** `<input type="datetime-local">` value (India time) to Date, or null. */
export function istDate(fd: FormData, name: string): Date | null {
  const v = str(fd, name);
  if (v === null) return null;
  const d = new Date(`${v.length === 10 ? `${v}T00:00` : v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date to a `datetime-local` value in India time. */
export function toIstInput(d: Date | number | null | undefined): string {
  if (d === null || d === undefined) return "";
  const ms = typeof d === "number" ? d : d.getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Short human date in India time, e.g. "28 Oct 2026, 14:30". */
export function fmtDate(d: Date | number | null | undefined, withTime = false): string {
  if (d === null || d === undefined) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(typeof d === "number" ? new Date(d) : d);
}

/**
 * URL slug from a title. Keeps Malayalam and other letters (WordPress keeps them too);
 * the stored value is decoded UTF-8, never percent-encoded.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** A link field checked with safeLink: site path, http(s), mailto: or tel:, else a FormError. */
export function link(fd: FormData, name: string): string | null {
  try {
    return safeLink(str(fd, name));
  } catch (e) {
    throw new FormError(e instanceof Error ? e.message : String(e));
  }
}

/** Where to send the editor after an action: a hidden `back` field inside /admin/, else the fallback. */
export function backTo(fd: FormData | undefined, fallback: string): string {
  const v = fd ? str(fd, "back") : null;
  return v && /^\/admin\/[\w\-/?=&#%.]*$/.test(v) ? v : fallback;
}

/** A validation problem worth showing to the editor as-is. */
export class FormError extends Error {}

/** Message for a caught error: FormError text, else a generic one (details go to the server log). */
export function errorMessage(e: unknown): string {
  if (e instanceof FormError) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint failed/i.test(msg)) return "That value is already used (for example the slug). Choose another.";
  console.error(e);
  return "Could not save. Check the server log for details.";
}

/** Next.js redirect() works by throwing; let it through catch blocks. */
export function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

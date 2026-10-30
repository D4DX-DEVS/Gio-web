// Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), the format
// every authenticator app uses. WebCrypto only, so it runs in workerd and Node alike.
// The shared secret lives in the environment (ADMIN_TOTP_SECRET), never in the database;
// codes are computed and compared, never stored. Plain module so node --test can load it.

export const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decodes RFC 4648 base32 (case-insensitive; spaces and padding ignored). Null when invalid. */
export function base32Decode(input: string): Uint8Array | null {
  const s = input.toUpperCase().replace(/[\s=]/g, "");
  if (!s || /[^A-Z2-7]/.test(s)) return null;
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of s) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + B32[(value << (5 - bits)) & 31] : out;
}

/** A usable secret is valid base32 of at least 128 bits (RFC 4226 minimum). */
export function isValidSecret(secret: string): boolean {
  const key = base32Decode(secret);
  return !!key && key.length >= 16;
}

export async function hotp(key: Uint8Array, counter: number, digits = DIGITS): Promise<string> {
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/**
 * The time step `code` belongs to (now, or one step either side for clock drift), or null.
 * Every candidate is computed and compared without early exit.
 */
export async function matchStep(secret: string, code: string, nowMs = Date.now()): Promise<number | null> {
  const key = base32Decode(secret);
  const clean = code.replace(/\s/g, "");
  if (!key || !/^\d{6}$/.test(clean)) return null;
  const step = Math.floor(nowMs / 1000 / STEP_SECONDS);
  let found: number | null = null;
  for (const s of [step - 1, step, step + 1]) {
    const expected = await hotp(key, s);
    let diff = 0;
    for (let i = 0; i < DIGITS; i++) diff |= expected.charCodeAt(i) ^ clean.charCodeAt(i);
    if (diff === 0 && found === null) found = s;
  }
  return found;
}

/** The otpauth:// URI an authenticator app imports (as a QR code or pasted). */
export function otpauthUri(secret: string, account: string, issuer = "GIO Kerala Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${q}`;
}

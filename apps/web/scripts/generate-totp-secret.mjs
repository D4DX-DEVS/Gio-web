// Generates a new two-factor (TOTP) secret for the admin login. Runs offline; nothing is sent
// anywhere and nothing is written to disk.
//
//   node scripts/generate-totp-secret.mjs [--account admin@gio]
//
// 1. Put the printed secret in ADMIN_TOTP_SECRET (apps/web/.dev.vars locally, or
//    `pnpm exec wrangler secret put ADMIN_TOTP_SECRET --env production`).
// 2. Add it to an authenticator app: paste the otpauth:// link into a QR generator you trust
//    offline, or type the secret in manually (time-based, SHA1, 6 digits, 30 seconds).
// Replacing the secret signs out every admin session and makes the old app entry useless.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { account: { type: "string", default: "admin" } } });
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0;
let value = 0;
let secret = "";
for (const b of randomBytes(20)) {
  value = (value << 8) | b;
  bits += 8;
  while (bits >= 5) {
    secret += B32[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}
const issuer = "GIO Kerala Admin";
const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log(`otpauth://totp/${encodeURIComponent(`${issuer}:${values.account}`)}?${q}`);

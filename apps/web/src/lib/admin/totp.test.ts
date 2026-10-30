// TOTP for the admin login, checked against the RFC 6238 appendix B test vectors (SHA-1).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { base32Decode, base32Encode, hotp, isValidSecret, matchStep, otpauthUri, STEP_SECONDS } from "./totp.ts";

// RFC 6238 seed "12345678901234567890" (ASCII), base32-encoded.
const SEED = base32Encode(new TextEncoder().encode("12345678901234567890"));
const VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("totp", () => {
  test("base32 round trip", () => {
    assert.equal(SEED, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    assert.deepEqual(base32Decode(SEED.toLowerCase().replace(/(.{4})/g, "$1 ")), new TextEncoder().encode("12345678901234567890"));
    assert.equal(base32Decode("not base32!"), null);
  });

  test("matches the RFC 6238 SHA-1 vectors", async () => {
    const key = base32Decode(SEED)!;
    for (const [t, code] of VECTORS) assert.equal(await hotp(key, Math.floor(t / STEP_SECONDS), 8), code, `T=${t}`);
  });

  test("accepts the current code and one step of drift, nothing more", async () => {
    const now = 1111111111 * 1000;
    const step = Math.floor(now / 1000 / STEP_SECONDS);
    const key = base32Decode(SEED)!;
    assert.equal(await matchStep(SEED, "050471", now), step);
    assert.equal(await matchStep(SEED, await hotp(key, step - 1), now), step - 1);
    assert.equal(await matchStep(SEED, await hotp(key, step + 1), now), step + 1);
    assert.equal(await matchStep(SEED, await hotp(key, step - 2), now), null);
    assert.equal(await matchStep(SEED, await hotp(key, step + 2), now), null);
  });

  test("rejects malformed codes", async () => {
    const now = 59_000;
    for (const bad of ["", "28708", "2870822", "abcdef", "287 08x"]) assert.equal(await matchStep(SEED, bad, now), null, bad);
    assert.equal(await matchStep(SEED, "287 082", now), 1);
  });

  test("secrets must be valid base32 of at least 128 bits", () => {
    assert.equal(isValidSecret(SEED), true);
    assert.equal(isValidSecret("JBSWY3DPEHPK3PXP"), false); // 80 bits
    assert.equal(isValidSecret("not-a-secret"), false);
  });

  test("otpauth URI carries the parameters authenticator apps need", () => {
    const u = new URL(otpauthUri(SEED, "admin@gio"));
    assert.equal(u.protocol, "otpauth:");
    assert.equal(u.searchParams.get("secret"), SEED);
    assert.equal(u.searchParams.get("digits"), "6");
    assert.equal(u.searchParams.get("period"), "30");
  });
});

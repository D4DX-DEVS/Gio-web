// Admin sign-in throttling, run against a real SQLite database built from the D1 migration.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { checkThrottle, clearKey, clientAddress, GLOBAL_KEY, recordFailure, type ThrottleDb, type ThrottleRule } from "./login-throttle.ts";

const MIGRATION = new URL("../../../../../packages/db/migrations/0002_admin_login_protection.sql", import.meta.url);

/** node:sqlite behind the small D1 surface the module uses. */
function freshDb(): ThrottleDb & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  for (const stmt of readFileSync(MIGRATION, "utf8").split("--> statement-breakpoint")) raw.exec(stmt);
  return {
    raw,
    prepare(sql) {
      return {
        bind(...values) {
          const stmt = raw.prepare(sql);
          const args = values as (string | number)[];
          return {
            first: async <T,>() => (stmt.get(...args) as T | undefined) ?? null,
            run: async () => stmt.run(...args),
          };
        },
      };
    },
  };
}

const RULE: ThrottleRule = { limit: 3, windowMs: 60_000, lockMs: 120_000 };
const T0 = 1_800_000_000_000;

describe("login throttle", () => {
  test("allows attempts below the limit", async () => {
    const db = freshDb();
    await recordFailure(db, "ip:a", RULE, T0);
    await recordFailure(db, "ip:a", RULE, T0 + 1);
    assert.deepEqual(await checkThrottle(db, ["ip:a"], T0 + 2), { limited: false });
  });

  test("locks at the limit and reports Retry-After seconds", async () => {
    const db = freshDb();
    for (let i = 0; i < 3; i++) await recordFailure(db, "ip:a", RULE, T0 + i);
    assert.deepEqual(await checkThrottle(db, ["ip:a"], T0 + 2), { limited: true, retryAfterSeconds: 120 });
    assert.deepEqual(await checkThrottle(db, ["ip:a"], T0 + 62_002), { limited: true, retryAfterSeconds: 58 });
  });

  test("the lock expires by itself (no permanent lockout)", async () => {
    const db = freshDb();
    for (let i = 0; i < 3; i++) await recordFailure(db, "ip:a", RULE, T0);
    assert.equal((await checkThrottle(db, ["ip:a"], T0 + 120_000)).limited, false);
  });

  test("a new window restarts the count", async () => {
    const db = freshDb();
    await recordFailure(db, "ip:a", RULE, T0);
    await recordFailure(db, "ip:a", RULE, T0 + 1);
    await recordFailure(db, "ip:a", RULE, T0 + 60_001); // window expired: count is 1 again
    await recordFailure(db, "ip:a", RULE, T0 + 60_002);
    assert.equal((await checkThrottle(db, ["ip:a"], T0 + 60_003)).limited, false);
    const row = db.raw.prepare("SELECT failures FROM admin_login_throttle WHERE key = 'ip:a'").get() as { failures: number };
    assert.equal(row.failures, 2);
  });

  test("failures during a lock do not extend it beyond lockMs from the latest lock", async () => {
    const db = freshDb();
    for (let i = 0; i < 3; i++) await recordFailure(db, "ip:a", RULE, T0);
    await recordFailure(db, "ip:a", RULE, T0 + 10_000);
    const s = await checkThrottle(db, ["ip:a"], T0 + 10_000);
    assert.ok(s.limited && s.retryAfterSeconds <= 120);
  });

  test("buckets are independent; any locked key limits the attempt", async () => {
    const db = freshDb();
    for (let i = 0; i < 3; i++) await recordFailure(db, "ip:a", RULE, T0);
    assert.equal((await checkThrottle(db, ["ip:b"], T0)).limited, false);
    for (let i = 0; i < 3; i++) await recordFailure(db, GLOBAL_KEY, RULE, T0);
    assert.equal((await checkThrottle(db, ["ip:b", GLOBAL_KEY], T0)).limited, true);
  });

  test("clearKey resets a bucket after a successful sign-in", async () => {
    const db = freshDb();
    await recordFailure(db, "ip:a", RULE, T0);
    await recordFailure(db, "ip:a", RULE, T0);
    await clearKey(db, "ip:a");
    await recordFailure(db, "ip:a", RULE, T0);
    await recordFailure(db, "ip:a", RULE, T0);
    assert.equal((await checkThrottle(db, ["ip:a"], T0)).limited, false);
  });

  test("idle buckets are cleaned up", async () => {
    const db = freshDb();
    await recordFailure(db, "ip:old", RULE, T0);
    await recordFailure(db, "ip:new", RULE, T0 + 25 * 60 * 60_000);
    const keys = (db.raw.prepare("SELECT key FROM admin_login_throttle").all() as { key: string }[]).map((r) => r.key);
    assert.deepEqual(keys, ["ip:new"]);
  });
});

describe("clientAddress", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  test("uses CF-Connecting-IP only on Cloudflare", () => {
    assert.equal(clientAddress(h({ "cf-connecting-ip": "203.0.113.7" }), true), "203.0.113.7");
    assert.equal(clientAddress(h({ "cf-connecting-ip": "2001:db8::1" }), true), "2001:db8::1");
    assert.equal(clientAddress(h({ "cf-connecting-ip": "203.0.113.7" }), false), "unknown");
  });

  test("never reads client-chosen forwarding headers", () => {
    assert.equal(clientAddress(h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8", "true-client-ip": "9.9.9.9" }), true), "unknown");
  });

  test("rejects malformed values", () => {
    assert.equal(clientAddress(h({ "cf-connecting-ip": "1.2.3.4, 5.6.7.8" }), true), "unknown");
    assert.equal(clientAddress(h({ "cf-connecting-ip": "x".repeat(10) }), true), "unknown");
  });
});

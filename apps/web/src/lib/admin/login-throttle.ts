// Failed-login throttling for /admin, stored in D1 (table admin_login_throttle, migration 0002)
// so every Worker instance shares the same counters. In-memory counters would be per isolate.
//
// Two buckets are checked before the password is looked at:
//   - per client IP: a few failures lock that IP for a while;
//   - global: many failures from anywhere (a distributed attack on the one admin account)
//     lock sign-in for everyone for a while.
// Locks always expire on their own, so nobody is locked out permanently. A successful
// sign-in clears its IP bucket. Plain module (no "@/" imports) so node --test can load it.

/** The part of D1Database this module uses (also satisfied by a node:sqlite wrapper in tests). */
export interface ThrottleDb {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface ThrottleRule {
  /** Failures allowed inside one window before the bucket locks. */
  limit: number;
  windowMs: number;
  lockMs: number;
}

export const IP_RULE: ThrottleRule = { limit: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const GLOBAL_RULE: ThrottleRule = { limit: 50, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const GLOBAL_KEY = "global";

export type ThrottleState = { limited: false } | { limited: true; retryAfterSeconds: number };

/** Locked if any of the keys is locked now; reports the longest remaining wait. */
export async function checkThrottle(db: ThrottleDb, keys: string[], now = Date.now()): Promise<ThrottleState> {
  let until = 0;
  for (const key of keys) {
    const row = await db.prepare("SELECT locked_until FROM admin_login_throttle WHERE key = ?1").bind(key).first<{ locked_until: number }>();
    if (row && row.locked_until > now) until = Math.max(until, row.locked_until);
  }
  return until ? { limited: true, retryAfterSeconds: Math.ceil((until - now) / 1000) } : { limited: false };
}

/**
 * Counts one failure for `key`. One atomic upsert: a window older than `windowMs` restarts at 1,
 * and reaching `limit` sets locked_until (an existing later lock is kept).
 */
export async function recordFailure(db: ThrottleDb, key: string, rule: ThrottleRule, now = Date.now()): Promise<void> {
  const expired = `admin_login_throttle.window_start <= ?2 - ?3`;
  const nextFailures = `CASE WHEN ${expired} THEN 1 ELSE admin_login_throttle.failures + 1 END`;
  await db
    .prepare(
      `INSERT INTO admin_login_throttle (key, failures, window_start, locked_until)
       VALUES (?1, 1, ?2, CASE WHEN ?4 <= 1 THEN ?2 + ?5 ELSE 0 END)
       ON CONFLICT(key) DO UPDATE SET
         failures = ${nextFailures},
         window_start = CASE WHEN ${expired} THEN ?2 ELSE admin_login_throttle.window_start END,
         locked_until = CASE WHEN ${nextFailures} >= ?4 THEN max(admin_login_throttle.locked_until, ?2 + ?5) ELSE admin_login_throttle.locked_until END`,
    )
    .bind(key, now, rule.windowMs, rule.limit, rule.lockMs)
    .run();
  // Housekeeping: drop buckets idle for a day.
  await db
    .prepare("DELETE FROM admin_login_throttle WHERE window_start < ?1 AND locked_until < ?2")
    .bind(now - 24 * 60 * 60_000, now)
    .run();
}

export async function clearKey(db: ThrottleDb, key: string): Promise<void> {
  await db.prepare("DELETE FROM admin_login_throttle WHERE key = ?1").bind(key).run();
}

/**
 * The client address to throttle on. Only Cloudflare's own `CF-Connecting-IP` is used, and only
 * when `trustCloudflare` is set (deployed Worker: Cloudflare's edge overwrites that header, so a
 * client cannot choose it). X-Forwarded-For and similar headers are never read. Without a trusted
 * address every request shares one "unknown" bucket, which is stricter, never looser.
 */
export function clientAddress(headers: Headers, trustCloudflare: boolean): string {
  if (!trustCloudflare) return "unknown";
  const ip = headers.get("cf-connecting-ip")?.trim();
  return ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : "unknown";
}

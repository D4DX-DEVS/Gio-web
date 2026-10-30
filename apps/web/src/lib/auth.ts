// Admin authentication. The ONLY admin login is the username and password in the Worker
// environment (ADMIN_USERNAME / ADMIN_PASSWORD: apps/web/.dev.vars locally, `wrangler secret put`
// in production). Nothing in the database can grant access.
//
// Better Auth still stores the session (D1, revocable on sign-out), signed in as one fixed
// internal user, `env-admin`, so audit_log, revisions and decidedBy keep a real user id.
// That user's database password is derived from BETTER_AUTH_SECRET and the env credentials;
// nobody types it. Every session is also bound to the current env credentials by an HMAC
// cookie, so changing ADMIN_USERNAME, ADMIN_PASSWORD or ADMIN_TOTP_SECRET signs every session
// out at once.
//
// Two-factor: with ADMIN_TOTP_SECRET set, sign-in also needs the 6-digit authenticator code;
// a production build refuses to sign anyone in without it. Failed attempts are throttled in D1
// (src/lib/admin/login-throttle.ts).
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { schema } from "@gio/db";
import { getDb, getEnv } from "@/lib/db";
import { checkThrottle, clearKey, GLOBAL_KEY, GLOBAL_RULE, IP_RULE, recordFailure } from "@/lib/admin/login-throttle";
import { isValidSecret, matchStep } from "@/lib/admin/totp";

export const ROLES = ["owner", "admin", "editor", "contributor"] as const;
export type Role = (typeof ROLES)[number];

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8787", "http://127.0.0.1:8787"];

/** The configured site address; the local dev and preview ports only when that address is local. */
export function trustedOrigins(baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? [...new Set([origin, ...LOCAL_ORIGINS])] : [origin];
}

// D1 bindings are only valid inside a request, so the instance is built per request.
export function getAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "GIO Kerala Admin",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: trustedOrigins(env.BETTER_AUTH_URL),
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: false },
    session: { expiresIn: SESSION_SECONDS, updateAge: 60 * 60 * 24 },
    user: {
      additionalFields: {
        role: { type: "string", required: false, input: false, defaultValue: "contributor" },
        isActive: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },
    // next.config trailingSlash: true makes `next dev` 308-redirect /api/* to a slashed path,
    // while OpenNext skips that redirect for /api/*. Accept both forms.
    advanced: { skipTrailingSlashes: true },
    // Lets auth.api calls inside Server Actions set the session cookie.
    plugins: [nextCookies()],
  });
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export const ENV_ADMIN_ID = "env-admin";
// Internal sign-in address of the env admin's user row; never shown or typed.
const ENV_ADMIN_EMAIL = "env-admin@admin.invalid";
const BINDING_COOKIE = "gio_admin_binding";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

interface AdminCredentials {
  username: string;
  password: string;
  name: string;
  /** Base32 TOTP secret, or null when two-factor is off (development only). */
  totpSecret: string | null;
}

const normalizeUsername = (s: string) => s.trim().toLowerCase();

/** Production builds require two-factor; `next dev` allows signing in without it. */
const twoFactorRequired = () => process.env.NODE_ENV === "production";

/**
 * The env credentials, or null when sign-in is not safely configured: missing values, a short
 * password, an invalid TOTP secret, or (production) no TOTP secret. Fails closed.
 */
export function adminCredentials(): AdminCredentials | null {
  const env = getEnv();
  const username = normalizeUsername(env.ADMIN_USERNAME ?? "");
  const password = env.ADMIN_PASSWORD ?? "";
  const totpSecret = env.ADMIN_TOTP_SECRET?.replace(/\s/g, "").toUpperCase() || null;
  if (!username || password.length < MIN_ADMIN_PASSWORD_LENGTH || !env.BETTER_AUTH_SECRET) return null;
  if (totpSecret ? !isValidSecret(totpSecret) : twoFactorRequired()) return null;
  return { username, password, name: env.ADMIN_NAME?.trim() || "Administrator", totpSecret };
}

async function hmacHex(...parts: string[]): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(getEnv().BETTER_AUTH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(JSON.stringify(parts)));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings in constant time by comparing their HMACs (equal length). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmacHex("cmp", a), hmacHex("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const bindingFor = (c: AdminCredentials, sessionToken: string) => hmacHex("binding", c.username, c.password, c.totpSecret ?? "", sessionToken);

/** Creates or refreshes the env admin's user row; it is always an active owner. */
async function upsertEnvAdmin(c: AdminCredentials) {
  const now = new Date();
  await getDb()
    .insert(schema.user)
    .values({ id: ENV_ADMIN_ID, name: c.name, email: ENV_ADMIN_EMAIL, emailVerified: true, role: "owner", isActive: true, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: schema.user.id, set: { name: c.name, email: ENV_ADMIN_EMAIL, role: "owner", isActive: true, updatedAt: now } });
}

/** Replaces the env admin's credential row and signs out its old sessions (env credentials changed). */
async function resetEnvAdminPassword(internalPassword: string) {
  const db = getDb();
  const now = new Date();
  await db.batch([
    db.delete(schema.session).where(eq(schema.session.userId, ENV_ADMIN_ID)),
    db.delete(schema.account).where(eq(schema.account.userId, ENV_ADMIN_ID)),
    db.insert(schema.account).values({
      id: crypto.randomUUID(),
      accountId: ENV_ADMIN_ID,
      providerId: "credential",
      userId: ENV_ADMIN_ID,
      password: await hashPassword(internalPassword),
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

/** Accepts a TOTP step only once: the stored last step must be older. */
async function consumeTotpStep(step: number): Promise<boolean> {
  const db = getEnv().DB;
  await db.prepare("INSERT OR IGNORE INTO admin_totp_state (id, last_step) VALUES (1, 0)").run();
  const row = await db.prepare("UPDATE admin_totp_state SET last_step = ?1 WHERE id = 1 AND last_step < ?1 RETURNING last_step").bind(step).first();
  return row !== null;
}

export type SignInResult = "ok" | "invalid" | "unconfigured" | { limited: true; retryAfterSeconds: number };

export interface SignInAttempt {
  username: string;
  password: string;
  /** Authenticator code; ignored when two-factor is off. */
  code: string;
  /** Throttling address from clientAddress() (never a client-chosen header). */
  clientAddress: string;
}

/**
 * Signs in when, and only when, the username, password and (if enabled) authenticator code
 * match the env credentials, and neither this address nor sign-in as a whole is locked.
 */
export async function signInAdmin(attempt: SignInAttempt): Promise<SignInResult> {
  const creds = adminCredentials();
  if (!creds) return "unconfigured";

  const db = getEnv().DB;
  const ipKey = `ip:${await hmacHex("throttle-ip", attempt.clientAddress)}`;
  // Checked before the password, so guesses during a lock learn nothing.
  const state = await checkThrottle(db, [ipKey, GLOBAL_KEY]);
  if (state.limited) return state;

  const [userOk, passOk, step] = await Promise.all([
    safeEqual(normalizeUsername(attempt.username), creds.username),
    safeEqual(attempt.password, creds.password),
    creds.totpSecret ? matchStep(creds.totpSecret, attempt.code) : Promise.resolve(0),
  ]);
  const ok = userOk && passOk && step !== null && (!creds.totpSecret || (await consumeTotpStep(step)));
  if (!ok) {
    await recordFailure(db, ipKey, IP_RULE);
    await recordFailure(db, GLOBAL_KEY, GLOBAL_RULE);
    return "invalid";
  }
  await clearKey(db, ipKey);

  await upsertEnvAdmin(creds);
  const internalPassword = await hmacHex("internal-password", creds.username, creds.password, creds.totpSecret ?? "");
  const auth = getAuth();
  const h = await headers();
  const signIn = () => auth.api.signInEmail({ body: { email: ENV_ADMIN_EMAIL, password: internalPassword }, headers: h });
  let result: Awaited<ReturnType<typeof signIn>>;
  try {
    result = await signIn();
  } catch {
    // First sign-in, or the env credentials changed since the last one.
    await resetEnvAdminPassword(internalPassword);
    result = await signIn();
  }

  (await cookies()).set(BINDING_COOKIE, await bindingFor(creds, result.token), {
    httpOnly: true,
    secure: new URL(getEnv().BETTER_AUTH_URL).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return "ok";
}

/** Ends the Better Auth session and drops the binding cookie. */
export async function signOutAdmin() {
  await getAuth().api.signOut({ headers: await headers() });
  (await cookies()).delete(BINDING_COOKIE);
}

/**
 * The signed-in admin, or null. Valid only for the env admin's session, and only while the
 * session's binding cookie matches the current env credentials.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const creds = adminCredentials();
  if (!creds) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.id !== ENV_ADMIN_ID) return null;
  const binding = (await cookies()).get(BINDING_COOKIE)?.value;
  if (!binding || !(await safeEqual(binding, await bindingFor(creds, session.session.token)))) return null;
  return { id: ENV_ADMIN_ID, name: creds.name, email: creds.username, role: "owner", isActive: true };
}

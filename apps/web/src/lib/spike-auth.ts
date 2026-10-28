// Spike D: Better Auth + Drizzle adapter on the per-request D1 binding.
// Local prototype only: no email sending, no production users. The real admin
// auth (roles, mandatory 2FA, Cloudflare Access, rate limits) is a later task.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb, schema } from "@gio/db";

// D1 bindings are only valid inside a request, so the instance is built per request.
export function getSpikeAuth(requestOrigin: string) {
  const { env } = getCloudflareContext();
  return betterAuth({
    appName: "GIO Kerala (local spike)",
    secret: env.BETTER_AUTH_SECRET,
    // Spike only: follow the origin the request came in on (next dev :3000 or preview :8787).
    baseURL: requestOrigin,
    basePath: "/api/spike-auth",
    trustedOrigins: ["http://localhost:3000", "http://localhost:8787", "http://127.0.0.1:8787"],
    database: drizzleAdapter(createDb(env.DB), { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false, // spike only; production admin accounts are invited, never self-registered
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, input: false, defaultValue: "contributor" },
        isActive: { type: "boolean", required: false, input: false, defaultValue: true },
      },
    },
    // next.config trailingSlash: true makes `next dev` 308-redirect /api/* to a slashed path,
    // while OpenNext skips that redirect for /api/* (@opennextjs/aws routing/matcher.js).
    // Accept both forms so dev and the Workers runtime behave the same.
    advanced: { skipTrailingSlashes: true },
    plugins: [twoFactor({ issuer: "GIO Kerala (local spike)" })],
  });
}

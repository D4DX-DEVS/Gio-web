// Spike D: read the session server-side through next/headers (as a Server
// Component or Server Action would), not through the auth HTTP endpoint.
import { headers } from "next/headers";
import { connection } from "next/server";
import { getSpikeAuth } from "@/lib/spike-auth";
import { notFound, spikesEnabled } from "@/lib/spikes";

export async function GET(request: Request) {
  await connection();
  if (!spikesEnabled()) return notFound();
  const started = Date.now();
  const session = await getSpikeAuth(new URL(request.url).origin).api.getSession({ headers: await headers() });
  return Response.json({
    signedIn: Boolean(session),
    user: session ? { email: session.user.email, role: session.user.role, twoFactorEnabled: session.user.twoFactorEnabled } : null,
    sessionExpiresAt: session?.session.expiresAt ?? null,
    ms: Date.now() - started,
  });
}

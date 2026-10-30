import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Admin sign-in happens only in POST /admin/sign-in/ against the env credentials (src/lib/auth.ts),
// and pages read the session server-side. Over HTTP only ending a session is exposed; every other
// Better Auth endpoint (sign-in, sign-up, get-session, password, user) answers 404.
const ALLOWED = new Set(["sign-out"]);

// Built per request because the D1 binding is request-scoped.
const handler = async (request: Request) => {
  const endpoint = new URL(request.url).pathname.replace(/^\/api\/auth\/?/, "").replace(/\/$/, "");
  if (!ALLOWED.has(endpoint)) return new Response("Not found", { status: 404 });
  return getAuth().handler(request);
};

export const { GET, POST } = toNextJsHandler(handler);

// POST target of the /admin/login/ form. A route handler rather than a Server Action so a locked
// sign-in can answer with a real HTTP 429 and Retry-After.
import { NextResponse, type NextRequest } from "next/server";
import { signInAdmin, trustedOrigins } from "@/lib/auth";
import { clientAddress } from "@/lib/admin/login-throttle";
import { getEnv } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };

// Relative Location: `next dev` rewrites req.url to localhost, which would move a 127.0.0.1 visitor
// to a host without the new session cookie.
const seeOther = (path: string) => new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: path } });

const back = (error: string) => seeOther(`/admin/login/?error=${error}`);

function tooMany(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Too many sign-in attempts · GIO Admin</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.4rem">Too many sign-in attempts</h1><p>Sign-in is paused for about ${minutes} minute${minutes === 1 ? "" : "s"} after repeated wrong attempts. Please wait and try again.</p><p><a href="/admin/login/">Back to sign-in</a></p></body></html>`;
  return new NextResponse(html, {
    status: 429,
    headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8", "Retry-After": String(retryAfterSeconds) },
  });
}

export async function POST(req: NextRequest) {
  // Server Actions check the Origin automatically; a route handler has to do it itself.
  const origin = req.headers.get("origin");
  if (!origin || !trustedOrigins(getEnv().BETTER_AUTH_URL).includes(origin)) {
    return new NextResponse("Forbidden", { status: 403, headers: NO_STORE });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back("1");
  }
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v.slice(0, 512) : "";
  };

  const result = await signInAdmin({
    username: field("username"),
    password: field("password"),
    code: field("code"),
    clientAddress: clientAddress(req.headers, process.env.NODE_ENV === "production"),
  });
  if (result === "ok") return seeOther("/admin/");
  if (result === "unconfigured") return back("config");
  if (result === "invalid") return back("1");
  return tooMany(result.retryAfterSeconds);
}

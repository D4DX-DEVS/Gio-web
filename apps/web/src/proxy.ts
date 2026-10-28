// Spike A: legacy URL redirects in Next.js 16 `proxy.ts` (Node.js runtime),
// built for Cloudflare Workers by @opennextjs/cloudflare.
// The redirect table here is disposable test data, not the site's URL map.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { spikesEnabled } from "@/lib/spikes";

// Synthetic Malayalam slug ("പരീക്ഷണം", "test"), stored decoded; WordPress
// emits the lowercase percent-encoded form.
const SPIKE_REDIRECTS: Record<string, string> = {
  "/spike-legacy/old-path/": "/spike-legacy/new-path/",
  "/spike-legacy/പരീക്ഷണം/": "/spike-legacy/ml-target/",
};
const SPIKE_WP_IDS: Record<string, string> = { "999999": "/spike-legacy/new-path/" };

export async function proxy(request: NextRequest) {
  if (!spikesEnabled()) return NextResponse.next();
  const { pathname, searchParams } = request.nextUrl;

  // Pattern rule: WordPress endpoints answer 410 Gone (05-MIGRATION-DESIGN.md §6.1)
  if (pathname === "/wp-login.php" || pathname === "/xmlrpc.php") {
    return new NextResponse("Gone", { status: 410, headers: { "x-spike-proxy": "pattern-410" } });
  }

  // Pattern rule: /?p=<id> → canonical URL via legacy WordPress id
  const p = searchParams.get("p");
  if (pathname === "/" && p && SPIKE_WP_IDS[p]) {
    return NextResponse.redirect(new URL(SPIKE_WP_IDS[p], request.url), 301);
  }

  // Exact match on the decoded path (Malayalam slugs arrive percent-encoded)
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // malformed escape: keep the raw path
  }
  const target = SPIKE_REDIRECTS[decoded] ?? SPIKE_REDIRECTS[pathname];
  if (target) {
    return NextResponse.redirect(new URL(target, request.url), 301);
  }

  // Can proxy reach the D1 binding? (needed if redirects are read from D1)
  const res = NextResponse.next();
  res.headers.set("x-spike-proxy", "next");
  if (pathname.startsWith("/spike-legacy/d1-check")) {
    try {
      const { env } = getCloudflareContext();
      const row = await env.DB.prepare("SELECT count(*) AS n FROM user").first<{ n: number }>();
      res.headers.set("x-spike-proxy-d1", `ok users=${row?.n}`);
    } catch (e) {
      res.headers.set("x-spike-proxy-d1", `error: ${(e as Error).message}`.slice(0, 200));
    }
  }
  return res;
}

export const config = {
  matcher: ["/", "/spike-legacy/:path*", "/wp-login.php", "/xmlrpc.php"],
};

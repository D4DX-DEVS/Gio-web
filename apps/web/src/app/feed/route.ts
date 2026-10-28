// RSS 2.0 feed of published posts. The legacy layer redirects old WordPress feed URLs here.
import { listPosts } from "@/lib/content";
import { stripHtml } from "@/lib/text";

const ORIGIN = "https://www.giokerala.org";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const { items } = await listPosts({}, 1, 30);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>GIO Kerala</title>
<link>${ORIGIN}/</link>
<atom:link href="${ORIGIN}/feed/" rel="self" type="application/rss+xml"/>
<description>Girls Islamic Organization</description>
<language>ml</language>
${items
  .map((p) => {
    const url = `${ORIGIN}/${encodeURIComponent(p.slug)}/`;
    return `<item>
<title>${esc(p.title || "Untitled post")}</title>
<link>${url}</link>
<guid isPermaLink="true">${url}</guid>
${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}
${p.categories.map((c) => `<category>${esc(c.name)}</category>`).join("")}
<description>${esc(stripHtml(p.excerpt, 400))}</description>
</item>`;
  })
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}

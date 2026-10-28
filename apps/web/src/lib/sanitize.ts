// HTML allow-list for content written in the admin or imported from WordPress.
import sanitizeHtml from "sanitize-html";

const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "www.facebook.com", "www.instagram.com"];

export function sanitize(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "iframe", "h1", "h2", "span", "u", "s", "video", "source"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder", "loading"],
      video: ["src", "controls", "width", "height", "poster"],
      source: ["src", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      "*": ["lang", "dir"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowedIframeHostnames: EMBED_HOSTS,
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "") && !/^https?:\/\/(www\.)?giokerala\.org/i.test(attribs.href ?? "");
        return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
    },
  });
}

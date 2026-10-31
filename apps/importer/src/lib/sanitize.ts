// Content clean-up that does not change meaning (05 §3, `transform` step):
// strip transliteration spans (keep text), strip the injected WP Social share widget,
// rewrite image and link URLs on the old site to root-relative paths, and sanitize
// with an allowlist. The untouched HTML is kept separately in legacy_body_html.
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { type Redactions, redactSecrets, sitePath, uploadsKey } from "./util";

const ALLOWED_IFRAME_HOSTS = [
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
  "www.google.com",
  "maps.google.com",
  "tamkeen.rehours.com",
  "forms.zohopublic.in",
];

const ALIGN_CLASSES = ["aligncenter", "alignleft", "alignright", "alignnone", "alignwide", "alignfull"];

export interface SanitizeResult {
  html: string;
  /** Upload keys of every image/file referenced, as found (before size-suffix stripping). */
  uploads: { key: string; field: "inline" | "link" }[];
}

export interface SanitizeOptions {
  /** Maps any uploads key (including resized copies) to the key that should be served. */
  resolveUpload?: (key: string) => string;
  redactions?: Redactions;
}

export function sanitizeContent(raw: string, opts: SanitizeOptions = {}): SanitizeResult {
  const resolve = opts.resolveUpload ?? ((k: string) => k);
  const uploads: SanitizeResult["uploads"] = [];
  const $ = cheerio.load(redactSecrets(raw, opts.redactions), null, false);

  // Injected share/follow widgets (WP Social plugin) are not content.
  $(".xs_social_share_widget, .xs-social-follower, .wslu-share-box-shaped, .xs_social_counter_widget").remove();

  $("img").each((_, el) => {
    const img = $(el);
    const src = img.attr("data-src") || img.attr("src") || "";
    const key = uploadsKey(src);
    if (key) {
      uploads.push({ key, field: "inline" });
      img.attr("src", `/${resolve(key)}`);
    }
    img.removeAttr("srcset").removeAttr("sizes").removeAttr("data-src");
    img.attr("loading", "lazy");
    img.attr("decoding", "async");
  });

  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = a.attr("href") ?? "";
    const key = uploadsKey(href);
    if (key) {
      uploads.push({ key, field: "link" });
      a.attr("href", `/${resolve(key)}`);
      return;
    }
    const path = sitePath(href);
    if (path) a.attr("href", path);
  });

  const html = sanitizeHtml($.html(), {
    allowedTags: [
      "p", "br", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "sub", "sup",
      "a", "ul", "ol", "li", "blockquote", "figure", "figcaption", "img", "iframe", "hr",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "code", "pre",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "class"],
      iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "loading", "referrerpolicy"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      figure: ["class"],
    },
    allowedClasses: { img: ALIGN_CLASSES, figure: ALIGN_CLASSES },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === "_blank") attribs.rel = "noopener noreferrer";
        return { tagName, attribs };
      },
      // The old editor used <h1> inside posts; the page title is the only h1 on the new site.
      h1: "h2",
    },
    exclusiveFilter: (frame) =>
      // Empty anchors left behind by removed widgets.
      frame.tag === "a" && !frame.text.trim() && !frame.mediaChildren.length,
  });

  return { html: html.trim(), uploads };
}

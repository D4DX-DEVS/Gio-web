// `html` adapter (05 §2): what only the rendered pages contain. Leaders (3 pages), homepage and
// other Elementor page sections, the header and social menus, contact details, and the uploads
// files referenced by HTML and Elementor CSS. Content is taken exactly as rendered; nothing is corrected.
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { MediaIndex } from "../media-index";
import type { BundleParts, LeaderRec, SectionItemRec, SectionRec } from "../model";
import { sanitizeContent } from "../lib/sanitize";
import type { Snapshot } from "../snapshot";
import { type Redactions, decodeEntities, filenameOf, htmlToText, redactSecrets, SITE_ORIGIN, sitePath, uploadsKey } from "../lib/util";
import { usage } from "./rest";

const url = (path: string) => `${SITE_ORIGIN}${path}`;

type $ = cheerio.CheerioAPI;

/** The Elementor content of the page itself, without the header template. */
function pageRoot($: $, pageId: number) {
  return $(`[data-elementor-type="wp-page"][data-elementor-id="${pageId}"]`).first();
}

/** Widgets in document order, skipping widgets nested inside another widget. */
function widgets($: $, root: cheerio.Cheerio<AnyNode>) {
  return root
    .find("[data-widget_type]")
    .toArray()
    .filter((el) => $(el).parents("[data-widget_type]").length === 0)
    .map((el) => ({ el: el as Element, type: $(el).attr("data-widget_type") ?? "", id: $(el).attr("data-id") ?? "" }));
}

function widgetSettings($: $, el: Element): Record<string, unknown> {
  try {
    return JSON.parse($(el).attr("data-settings") ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Alt text only when it says something; WordPress fills empty alts with the file name. */
function meaningfulAlt(alt: string | undefined, path: string | null): string | null {
  const a = decodeEntities(alt ?? "").trim();
  if (!a) return null;
  const stem = path ? filenameOf(path).replace(/\.[a-z0-9]+$/i, "") : "";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (stem && (norm(a) === norm(stem) || norm(stem).startsWith(norm(a)))) return null;
  if (/^(whatsapp image|img[_-]?\d|dsc\d|screenshot)/i.test(a)) return null;
  return a;
}

function imgPath($: $, img: cheerio.Cheerio<Element>): string | null {
  return uploadsKey(img.attr("data-src") || img.attr("src") || "");
}

export function readHtml(snap: Snapshot, media: MediaIndex, parts: BundleParts, redactions: Redactions): void {
  const pageKeyByPath = new Map(parts.pages.map((p) => [p.slug ? `/${p.slug}/` : "/", p.key]));
  const sanitize = (html: string) => sanitizeContent(html, { resolveUpload: (k) => media.resolve(k), redactions });

  readLeaders(snap, media, parts);
  readHome(snap, media, parts, sanitize);
  readInfoPages(snap, media, parts, sanitize);
  readMenus(snap, media, parts, pageKeyByPath);
  readCssBackgrounds(snap, media, parts);
  readAllReferencedUploads(snap, media, parts);
}

// ---------------------------------------------------------------------------
// Leaders
// ---------------------------------------------------------------------------

const LEADER_PAGES = [
  { path: "/team/", pageId: 303, scope: "state" as const },
  { path: "/district-leaders/", pageId: 1742, scope: "district" as const },
  { path: "/former-leaders/", pageId: 2244, scope: "former" as const },
];

export interface EmptyLeaderSlot {
  page: string;
  position: number;
  photo: string | null;
}

export const emptyLeaderSlots: EmptyLeaderSlot[] = [];

function readLeaders(snap: Snapshot, media: MediaIndex, parts: BundleParts): void {
  emptyLeaderSlots.length = 0;
  for (const lp of LEADER_PAGES) {
    const html = snap.html(url(lp.path));
    if (!html) {
      parts.warnings.push(`leaders: no snapshot HTML for ${lp.path}`);
      continue;
    }
    const $ = cheerio.load(html);
    const root = pageRoot($, lp.pageId);
    const groups = new Map<string, string>(); // term/heading -> group key
    const groupKey = (label: string | null) => {
      const k = label ?? "";
      let g = groups.get(k);
      if (!g) {
        g = `html:leader_group:${lp.path}#${groups.size + 1}`;
        groups.set(k, g);
        parts.leaderGroups.push({
          key: g,
          source: "html_parse",
          sourceRef: g,
          reviewState: "verified",
          scope: lp.scope,
          heading: lp.scope === "former" ? label : null,
          termLabel: lp.scope === "former" ? label : null,
          sort: groups.size,
        });
      }
      return g;
    };

    let position = 0;
    let sort = 0;
    for (const w of widgets($, root)) {
      if (!w.type.startsWith("wpr-team-member")) continue;
      position++;
      const el = $(w.el);
      const name = htmlToText(el.find(".wpr-member-name").first().html() ?? "");
      const role = htmlToText(el.find(".wpr-member-job").first().html() ?? "") || null;
      const desc = htmlToText(el.find(".wpr-member-description").first().html() ?? "") || null;
      const photoPath = imgPath($, el.find("img").first());
      if (!name) {
        // Q10: an empty team-member widget. Recorded for review, not turned into a person.
        emptyLeaderSlots.push({ page: lp.path, position, photo: photoPath });
        continue;
      }
      const links = [
        ...new Set(
          el
            .find("a[href]")
            .toArray()
            .map((a) => decodeEntities($(a).attr("href") ?? "").trim())
            .filter((h) => /^https?:\/\//.test(h)),
        ),
      ];
      const key = `html:leader:${lp.path}#${position}`;
      const photo = photoPath ? usage(parts, media, photoPath, key, "leader", "photo") : null;
      if (photo) {
        const m = media.byPath.get(media.resolve(photoPath!));
        if (m && !m.usageHint) m.usageHint = "leader_photo";
      }
      const term = lp.scope === "former" ? desc : null;
      const rec: LeaderRec = {
        key,
        source: "html_parse",
        sourceRef: key,
        reviewState: "verified",
        group: groupKey(term),
        name,
        roleTitle: role,
        // District leaders publish the unit in the role, e.g. 'Kasargod (President)'. role_title keeps
        // that text exactly; `district` is the part before the parenthesis, for grouping only.
        district: lp.scope === "district" && role ? (/^(.+?)\s*\(/.exec(role)?.[1]?.trim() ?? null) : null,
        description: desc,
        photo,
        facebookUrl: links.find((h) => /facebook\.com/i.test(h)) ?? null,
        instagramUrl: links.find((h) => /instagram\.com/i.test(h)) ?? null,
        otherLinks: links.filter((h) => !/facebook\.com|instagram\.com/i.test(h)),
        sort: ++sort,
        isVisible: true,
        legacySourceUrl: lp.path,
      };
      parts.leaders.push(rec);
    }
  }
}

// ---------------------------------------------------------------------------
// Page sections
// ---------------------------------------------------------------------------

type Sanitize = (html: string) => ReturnType<typeof sanitizeContent>;

class SectionBuilder {
  private sort = 0;
  constructor(
    private readonly parts: BundleParts,
    private readonly media: MediaIndex,
    private readonly pageKey: string,
    private readonly pageId: number,
  ) {}

  section(type: SectionRec["type"], widgetId: string, data: Record<string, unknown>, title: string | null = null) {
    const key = `html:section:${this.pageId}:${widgetId}`;
    this.parts.sections.push({
      key,
      source: "html_parse",
      sourceRef: key,
      reviewState: "verified",
      page: this.pageKey,
      type,
      title,
      data,
      sort: ++this.sort,
      legacyRef: `elementor:${this.pageId}:${widgetId}`,
    });
    let itemSort = 0;
    return {
      key,
      item: (i: Partial<Omit<SectionItemRec, "key" | "section" | "sort">> & { mediaPath?: string | null; field: string }) => {
        const ikey = `${key}:${++itemSort}`;
        let mediaKey: string | null = null;
        if (i.mediaPath) mediaKey = usage(this.parts, this.media, i.mediaPath, ikey, "section_item", i.field);
        const linked = i.linkUrl ? uploadsKey(i.linkUrl) : null;
        if (linked) usage(this.parts, this.media, linked, ikey, "section_item", "link");
        this.parts.sectionItems.push({
          key: ikey,
          source: "html_parse",
          sourceRef: ikey,
          reviewState: "verified",
          section: key,
          media: mediaKey,
          heading: i.heading ?? null,
          body: i.body ?? null,
          linkUrl: i.linkUrl ?? null,
          linkLabel: i.linkLabel ?? null,
          openInNewTab: i.openInNewTab ?? false,
          altText: i.altText ?? null,
          sort: itemSort,
        });
        return mediaKey;
      },
    };
  }
}

function linkOf($: $, el: cheerio.Cheerio<AnyNode>): { url: string; newTab: boolean } | null {
  const a = el.is("a") ? el : el.find("a[href]").first();
  const href = a.attr("href");
  if (!href || href === "#") return null;
  const key = uploadsKey(href);
  return { url: key ? `/${key}` : (sitePath(href) ?? decodeEntities(href)), newTab: a.attr("target") === "_blank" };
}

function hint(media: MediaIndex, path: string | null, h: string) {
  if (!path) return;
  const m = media.byPath.get(media.resolve(path));
  if (m && !m.usageHint) m.usageHint = h;
}

function readHome(snap: Snapshot, media: MediaIndex, parts: BundleParts, sanitize: Sanitize): void {
  const html = snap.html(url("/"));
  const page = parts.pages.find((p) => p.legacyWpId === 2074);
  if (!html || !page) {
    parts.warnings.push("home: snapshot HTML or page 2074 missing; homepage sections not imported");
    return;
  }
  const $ = cheerio.load(html);
  const b = new SectionBuilder(parts, media, page.key, 2074);
  let carousels = 0;
  for (const w of widgets($, pageRoot($, 2074))) {
    const el = $(w.el);
    const settings = widgetSettings($, w.el);
    switch (w.type) {
      case "image-carousel.default": {
        const imgs = el.find(".swiper-slide:not(.swiper-slide-duplicate) img").toArray();
        const isHero = carousels++ === 0 && Number(settings.slides_to_show ?? 1) <= 1;
        const s = b.section(isHero ? "hero_carousel" : "logo_carousel", w.id, {
          autoplay: settings.autoplay === "yes",
          intervalMs: Number(settings.autoplay_speed ?? 5000),
          ...(isHero ? { effect: settings.effect ?? "slide" } : { slidesToShow: Number(settings.slides_to_show ?? 6) }),
        });
        const seen = new Set<string>();
        for (const img of imgs) {
          const p = imgPath($, $(img));
          if (!p || seen.has(media.resolve(p))) continue;
          seen.add(media.resolve(p));
          const link = linkOf($, $(img).closest("a"));
          s.item({ mediaPath: p, field: isHero ? "slide" : "logo", altText: meaningfulAlt($(img).attr("alt"), p), linkUrl: link?.url, openInNewTab: link?.newTab });
          hint(media, p, isHero ? "banner" : "logo");
        }
        break;
      }
      case "image.default": {
        const img = el.find("img").first();
        const p = imgPath($, img);
        if (!p) break;
        const link = linkOf($, el);
        const s = b.section(link ? "image_banner" : "image", w.id, {});
        s.item({ mediaPath: p, field: link ? "banner" : "image", altText: meaningfulAlt(img.attr("alt"), p), linkUrl: link?.url, openInNewTab: link?.newTab });
        hint(media, p, "banner");
        break;
      }
      case "text-editor.default": {
        const body = sanitize(el.find(".elementor-widget-container").first().html() ?? el.html() ?? "");
        for (const u of body.uploads) usage(parts, media, u.key, page.key, "page", u.field);
        b.section("rich_text", w.id, { html: body.html });
        break;
      }
      case "shortcode.default": {
        if (el.find("#sb_instagram, .sbi").length) {
          const profile = el.find('a[href*="instagram.com/"]').toArray().map((a) => $(a).attr("href") ?? "").find((h) => /instagram\.com\/[^/]+\/?$/.test(h) && !/\/(p|reel)\//.test(h));
          const handle = profile ? /instagram\.com\/([^/?#]+)/.exec(profile)?.[1] ?? null : null;
          const shown = el.find(".sbi_item").length;
          // C11: live API vs embed is undecided. The posts themselves are not copied.
          b.section("instagram_feed", w.id, { handle, profileUrl: profile ?? null, count: shown || 8, mode: "embed" });
        } else if (el.find(".sp-slide, .sp-image").length) {
          const s = b.section("poster_slider", w.id, {});
          for (const img of el.find("img.sp-image").toArray()) {
            const p = imgPath($, $(img));
            if (!p) continue;
            const link = linkOf($, $(img).closest("a"));
            s.item({ mediaPath: p, field: "poster", altText: meaningfulAlt($(img).attr("alt"), p), linkUrl: link?.url, openInNewTab: link?.newTab });
            hint(media, p, "banner");
          }
        } else {
          parts.warnings.push(`home: unrecognised shortcode widget ${w.id}; not imported`);
        }
        break;
      }
      case "video.default": {
        const yt = String(settings.youtube_url ?? "");
        const id = /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(yt)?.[1] ?? null;
        b.section("featured_video", w.id, { provider: "youtube", youtubeId: id, url: yt });
        break;
      }
      default:
        parts.warnings.push(`home: widget ${w.id} (${w.type}) not mapped to a section`);
    }
  }
}

/** Elementor-built informational pages (05 §8.1): About, Contact, Call for Papers, Tamkeen. */
function readInfoPages(snap: Snapshot, media: MediaIndex, parts: BundleParts, sanitize: Sanitize): void {
  for (const page of parts.pages) {
    if (page.template !== "sections" || page.legacyWpId === 2074 || !page.legacyWpId) continue;
    const id = page.legacyWpId;
    const b = new SectionBuilder(parts, media, page.key, id);
    const html = snap.html(url(`/${page.slug}/`));
    const $ = html ? cheerio.load(html) : null;
    const root = $ ? pageRoot($, id) : null;
    const ws = $ && root && root.length ? widgets($, root) : [];

    if (!ws.length) {
      // Not built with Elementor (Tamkeen): use the REST content.
      const raw = page.legacyBodyHtml ?? "";
      const iframe = /<iframe[^>]+src="([^"]+)"/i.exec(raw);
      if (iframe) {
        b.section("embed", "content", { src: decodeEntities(iframe[1]), title: page.title, fullHeight: true });
      } else if (raw.trim()) {
        const body = sanitize(raw);
        b.section("rich_text", "content", { html: body.html });
      }
      continue;
    }

    let pendingHeading: string | null = null;
    const flushHeading = (wid: string) => {
      if (pendingHeading) b.section("rich_text", wid, { html: `<h2>${escapeHtml(pendingHeading)}</h2>` });
      pendingHeading = null;
    };
    const contactLines: { label: string; value: string }[] = [];
    let contactHeading: string | null = null;
    for (const w of ws) {
      const el = $!(w.el);
      switch (w.type) {
        case "heading.default":
        case "elementskit-heading.default": {
          flushHeading(`${w.id}-h`);
          pendingHeading = htmlToText(el.find(".elementor-heading-title, .ekit-heading--title").first().html() ?? el.html() ?? "") || null;
          break;
        }
        case "text-editor.default": {
          const body = sanitize(el.find(".elementor-widget-container").first().html() ?? el.html() ?? "");
          for (const u of body.uploads) usage(parts, media, u.key, page.key, "page", u.field);
          if (body.html || pendingHeading) {
            const h = pendingHeading ? `<h2>${escapeHtml(pendingHeading)}</h2>` : "";
            pendingHeading = null;
            b.section("rich_text", w.id, { html: h + body.html });
          }
          break;
        }
        case "image.default": {
          flushHeading(`${w.id}-h`);
          const img = el.find("img").first();
          const p = imgPath($!, img);
          if (!p) break;
          const link = linkOf($!, el);
          const s = b.section(link ? "image_banner" : "image", w.id, {});
          s.item({ mediaPath: p, field: link ? "banner" : "image", altText: meaningfulAlt(img.attr("alt"), p), linkUrl: link?.url, openInNewTab: link?.newTab });
          hint(media, p, "banner");
          break;
        }
        case "wpr-form-builder.default": {
          const fields = el
            .find("input[name^='form_fields'], textarea[name^='form_fields']")
            .toArray()
            .map((f) => ({
              name: /form_fields\[(.+)\]/.exec($!(f).attr("name") ?? "")?.[1] ?? "",
              label: $!(f).attr("placeholder") ?? "",
              type: f.tagName === "textarea" ? "textarea" : ($!(f).attr("type") ?? "text"),
              required: $!(f).is("[required]"),
            }));
          b.section("contact_form", w.id, { heading: pendingHeading, fields, submitLabel: htmlToText(el.find("button").first().html() ?? "") || null });
          pendingHeading = null;
          break;
        }
        case "icon-box.default": {
          if (!contactHeading) {
            contactHeading = pendingHeading;
            pendingHeading = null;
          }
          const label = htmlToText(el.find(".elementor-icon-box-title").first().html() ?? "");
          const valueEl = el.find(".elementor-icon-box-description").first();
          const cf = valueEl.find("[data-cfemail]").attr("data-cfemail");
          const value = cf ? decodeCfEmail(cf) : htmlToText(valueEl.html() ?? "");
          contactLines.push({ label, value });
          break;
        }
        default: {
          const iframe = el.find("iframe").first();
          if (iframe.length && /google\.[a-z.]+\/maps/.test(iframe.attr("src") ?? "")) {
            flushContact();
            const src = redactSecrets(decodeEntities(iframe.attr("src") ?? ""), redactions_);
            b.section("map", w.id, { embedUrl: src, title: iframe.attr("title") ?? null });
          } else {
            parts.warnings.push(`${page.legacyUrl}: widget ${w.id} (${w.type}) not mapped to a section`);
          }
        }
      }
    }
    flushContact();
    flushHeading("end-h");

    function flushContact() {
      if (!contactLines.length) return;
      const html =
        (contactHeading ? `<h2>${escapeHtml(contactHeading)}</h2>` : "") +
        contactLines.map((l) => `<h3>${escapeHtml(l.label)}</h3><p>${linkify(l.value)}</p>`).join("");
      b.section("rich_text", "contact-details", { html, kind: "contact_details" });
      for (const l of contactLines) {
        const k = /phone/i.test(l.label) ? "phone" : /email/i.test(l.label) ? "email" : /address/i.test(l.label) ? "address" : null;
        if (k) parts.settings.push({ key: k, value: l.value, source: "html_parse", sourceRef: `html:${page.legacyUrl}#${k}`, reviewState: "verified" });
      }
      contactLines.length = 0;
    }
  }
}

// The redaction counter for the map embed is shared with the rest of the run.
let redactions_: Redactions = { count: 0 };
export function setHtmlRedactions(r: Redactions) {
  redactions_ = r;
}

function linkify(v: string): string {
  const e = escapeHtml(v);
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return `<a href="mailto:${e}">${e}</a>`;
  if (/^\+?[\d\s-]{8,}$/.test(v)) return `<a href="tel:${v.replace(/[^\d+]/g, "")}">${e}</a>`;
  return e;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Cloudflare email obfuscation: first byte is the XOR key for the rest. */
export function decodeCfEmail(hex: string): string {
  const key = Number.parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

// ---------------------------------------------------------------------------
// Menus and site identity
// ---------------------------------------------------------------------------

function readMenus(snap: Snapshot, media: MediaIndex, parts: BundleParts, pageKeyByPath: Map<string, string>): void {
  const html = snap.html(url("/"));
  if (!html) return;
  const $ = cheerio.load(html);
  const header = $("body").clone();
  header.find('[data-elementor-type="wp-page"]').remove();

  parts.menus.push({ key: "header", label: "Header menu" }, { key: "social", label: "Social links" });
  const nav = header.find("ul.wpr-nav-menu").first();
  let sort = 0;
  for (const li of nav.children("li").toArray()) {
    const a = $(li).children("a").first();
    const label = htmlToText(a.html() ?? "");
    const href = a.attr("href") ?? "";
    const path = href ? sitePath(href) : null;
    const key = `html:menu:header:${++sort}`;
    parts.menuItems.push({
      key,
      source: "html_parse",
      sourceRef: key,
      reviewState: "verified",
      menu: "header",
      parent: null,
      label,
      url: path ?? (href || null),
      page: path ? (pageKeyByPath.get(path) ?? null) : null,
      icon: null,
      openInNewTab: a.attr("target") === "_blank",
      sort,
    });
    let childSort = 0;
    for (const sub of $(li).find("ul li > a").toArray()) {
      const sa = $(sub);
      const sp = sitePath(sa.attr("href") ?? "");
      const ckey = `${key}.${++childSort}`;
      parts.menuItems.push({
        key: ckey,
        source: "html_parse",
        sourceRef: ckey,
        reviewState: "verified",
        menu: "header",
        parent: key,
        label: htmlToText(sa.html() ?? ""),
        url: sp,
        page: sp ? (pageKeyByPath.get(sp) ?? null) : null,
        icon: null,
        openInNewTab: sa.attr("target") === "_blank",
        sort: childSort,
      });
    }
  }
  if (!sort) parts.warnings.push("menus: header menu (ul.wpr-nav-menu) not found");

  let s = 0;
  const seen = new Set<string>();
  for (const a of header.find("a.elementor-social-icon").toArray()) {
    const href = $(a).attr("href") ?? "";
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const icon = /elementor-social-icon-([a-z-]+)/.exec($(a).attr("class") ?? "")?.[1] ?? null;
    const key = `html:menu:social:${++s}`;
    parts.menuItems.push({
      key,
      source: "html_parse",
      sourceRef: key,
      reviewState: "verified",
      menu: "social",
      parent: null,
      label: htmlToText($(a).html() ?? "") || icon || href,
      url: href,
      page: null,
      icon: icon === "x-twitter" ? "x" : icon,
      openInNewTab: true,
      sort: s,
    });
  }

  const logo = header.find("img").toArray().map((i) => uploadsKey($(i).attr("src") ?? "")).find(Boolean);
  if (logo) {
    const k = usage(parts, media, logo, "setting:logo", "site_settings", "logo");
    hint(media, logo, "logo");
    parts.settings.push({ key: "logo_media", value: k, source: "html_parse", sourceRef: "html:/#header-logo", reviewState: "verified" });
  }
  const title = $("title").first().text().trim();
  const [siteName, tagline] = title.split("|").map((x) => x.trim());
  if (siteName) parts.settings.push({ key: "site_name", value: siteName, source: "html_parse", sourceRef: "html:/#title", reviewState: "verified" });
  if (tagline) parts.settings.push({ key: "tagline", value: tagline, source: "html_parse", sourceRef: "html:/#title", reviewState: "verified" });
  const lang = $("html").attr("lang");
  if (lang) parts.settings.push({ key: "html_lang_old_site", value: lang, source: "html_parse", sourceRef: "html:/#lang", reviewState: "verified" });
}

// ---------------------------------------------------------------------------
// Files referenced by CSS and HTML
// ---------------------------------------------------------------------------

/** Elementor CSS backgrounds (post-<id>.css). For listing pages the first one is the page header image. */
function readCssBackgrounds(snap: Snapshot, media: MediaIndex, parts: BundleParts): void {
  const pageById = new Map(parts.pages.map((p) => [p.legacyWpId, p]));
  for (const f of snap.cssFiles()) {
    const id = Number(/^post-(\d+)\.css$/.exec(f.name)?.[1]);
    const urls = [...f.text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => uploadsKey(m[1])).filter((k): k is string => Boolean(k));
    const page = pageById.get(id);
    for (const k of urls) {
      if (/\/elementor\//.test(k)) continue;
      const entityKey = page ? page.key : `css:${f.name}`;
      const mk = usage(parts, media, k, entityKey, page ? "page" : "css", "css_background", "css_parse");
      if (page && page.template === "post_listing" && !page.templateConfig?.headerImage) {
        page.templateConfig = { ...(page.templateConfig ?? {}), headerImage: mk };
      }
    }
  }
}

/**
 * Every uploads file referenced anywhere in the rendered snapshot of the pages being imported,
 * so the file list is a superset of what visitors can reach (05 §5.2 item 4). Theme-demo pages are
 * skipped: their files are only fetched if they are also in the media library.
 */
function readAllReferencedUploads(snap: Snapshot, media: MediaIndex, parts: BundleParts): void {
  const realPaths = new Set(parts.legacyUrls.filter((u) => u.action === "same_path").map((u) => u.oldPath));
  for (const [u, e] of Object.entries(snap.crawl)) {
    const path = sitePath(u);
    if (!path || !e.file || !realPaths.has(path)) continue;
    const html = snap.html(u)!.replaceAll("\\/", "/");
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?giokerala\.org\/wp-content\/uploads\/[^"'\s)>,]+/g)) {
      const k = uploadsKey(decodeEntities(m[0]));
      if (!k || /\/(elementor|wpr-[a-z-]+|sb-instagram-feed-images)\//.test(k) || /\.(css|js)$/i.test(k)) continue;
      if (!/\.(jpe?g|png|gif|webp|svg|heic|pdf|docx?|xlsx?|pptx?|zip|mp4|mp3)$/i.test(k)) continue;
      media.addReferenced(k, "html_parse", `html:${path}`);
    }
  }
}

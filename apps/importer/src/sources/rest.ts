// `rest` adapter (05 §2): published posts, pages, media metadata, taxonomies, authors and
// The Events Calendar records from migration/snapshot-*/rest/*.json.
import type { MediaIndex, WpMedia } from "../media-index";
import { mediaKey } from "../media-index";
import type { BundleParts, PageRec } from "../model";
import { sanitizeContent } from "../lib/sanitize";
import type { Snapshot } from "../snapshot";
import {
  type Redactions,
  decodeEntities,
  htmlToText,
  percentDecode,
  redactSecrets,
  sitePath,
  uploadsKey,
  wpGmtToMs,
} from "../lib/util";

interface Rendered {
  rendered: string;
}

interface WpPost {
  id: number;
  date_gmt: string;
  modified_gmt: string;
  slug: string;
  status: string;
  link: string;
  title: Rendered;
  content: Rendered;
  excerpt: Rendered;
  author: number;
  featured_media: number;
  categories?: number[];
  tags?: number[];
  template?: string;
  yoast_head_json?: { title?: string; description?: string; og_image?: { url: string }[] };
}

interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description?: string;
  count: number;
}

interface WpUser {
  id: number;
  name: string;
  slug: string;
}

interface TecVenue {
  id: number;
  venue: string;
  address?: string;
  city?: string;
  province?: string;
  state?: string;
  country?: string;
  zip?: string;
}

interface TecOrganizer {
  id: number;
  organizer: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface TecEvent {
  id: number;
  slug: string;
  url: string;
  title: string;
  description: string;
  status: string;
  all_day: boolean;
  timezone: string;
  utc_start_date: string;
  utc_end_date: string;
  cost: string;
  website: string;
  image: false | { url: string; id?: number };
  venue: TecVenue | [];
  organizer: TecOrganizer[];
  categories: { id: number; slug: string; name: string }[];
}

/**
 * How each of the 14 pages the REST API counts is handled (reconciled against 04 §4.1 and url_map.csv).
 * 11 are real pages. 'events' (2651) is an empty page shadowed by the calendar archive (C7).
 * 'coming-soon' (319) and 'causes' (343, HTTP 500, not in the public listing) are theme-demo pages (D4).
 */
export const PAGE_PLAN: Record<
  number,
  | { import: true; slug: string; template: PageRec["template"]; config?: Record<string, unknown> }
  | { import: false; reason: string; decisionRef: string }
> = {
  2074: { import: true, slug: "", template: "sections" },
  280: { import: true, slug: "about-us", template: "sections" },
  303: { import: true, slug: "team", template: "leaders", config: { scope: "state" } },
  1742: { import: true, slug: "district-leaders", template: "leaders", config: { scope: "district" } },
  2244: { import: true, slug: "former-leaders", template: "leaders", config: { scope: "former" } },
  2660: { import: true, slug: "gio-news", template: "post_listing", config: { category: "gio-news", perPage: 9 } },
  2684: { import: true, slug: "gio-events", template: "post_listing", config: { category: "gio-events", perPage: 9 } },
  526: { import: true, slug: "news-events", template: "post_listing", config: { perPage: 9 } },
  406: { import: true, slug: "contact-us", template: "sections" },
  3424: { import: true, slug: "call-for-papers", template: "sections" },
  3480: { import: true, slug: "tamkeen", template: "sections" },
  2651: {
    import: false,
    reason: "Empty WordPress page; /events/ is served by the events calendar archive",
    decisionRef: "C7",
  },
  319: { import: false, reason: "Theme 'Coming Soon' template page", decisionRef: "D4" },
  343: { import: false, reason: "Theme 'Causes' demo page (HTTP 500 on the live site)", decisionRef: "D4" },
};

/** Tags created by the theme demo import (D4b). */
const DEMO_TAG_SLUGS = new Set(["charity", "donation", "poor"]);
/** Venues created by the theme demo import (D4b). */
const DEMO_VENUE_IDS = new Set([70, 71]);
/** The theme demo event (D4). */
const DEMO_EVENT_IDS = new Set([636]);

export function readRest(snap: Snapshot, media: MediaIndex, parts: BundleParts, redactions: Redactions): void {
  media.addRestItems(snap.rest<WpMedia[]>("media.json"));
  const sanitize = (html: string) =>
    sanitizeContent(html, { resolveUpload: (k) => media.resolve(k), redactions });

  for (const u of snap.rest<WpUser[]>("users.json")) {
    parts.authors.push({
      key: `wp:user:${u.id}`,
      source: "wp_rest",
      sourceRef: `wp:user:${u.id}`,
      reviewState: "verified",
      displayName: decodeEntities(u.name),
      slug: u.slug,
      legacyWpId: u.id,
    });
  }

  for (const c of snap.rest<WpTerm[]>("categories.json")) {
    parts.categories.push(term(c, "category"));
  }
  for (const t of snap.rest<WpTerm[]>("tags.json")) {
    if (DEMO_TAG_SLUGS.has(t.slug)) {
      parts.excluded.push({
        key: `wp:tag:${t.id}`,
        kind: "tag",
        label: t.slug,
        reason: `Theme demo tag (${t.count} posts)`,
        decisionRef: "D4b",
      });
      continue;
    }
    parts.tags.push(term(t, "tag"));
  }

  // ---- posts
  for (const p of snap.rest<WpPost[]>("posts.json")) {
    const key = `wp:post:${p.id}`;
    const body = sanitize(p.content.rendered);
    const path = sitePath(p.link) ?? `/${p.slug}/`;
    for (const u of body.uploads) usage(parts, media, u.key, key, "post", u.field);
    const featured = media.keyForWpId(p.featured_media);
    if (p.featured_media && !featured) {
      parts.warnings.push(`${key}: featured_media ${p.featured_media} is not in the public media listing`);
    }
    if (featured) parts.mediaUsage.push({ media: featured, entityKey: key, entityType: "post", field: "featured" });
    const y = p.yoast_head_json ?? {};
    const ogPath = y.og_image?.[0]?.url ? uploadsKey(y.og_image[0].url) : null;
    const title = htmlToText(p.title.rendered);
    parts.posts.push({
      key,
      source: "wp_rest",
      sourceRef: key,
      // Q1: the untitled post stays as published and goes to the review queue.
      reviewState: title ? "verified" : "pending_client",
      slug: percentDecode(p.slug),
      title,
      excerpt: htmlToText(p.excerpt.rendered) || null,
      bodyHtml: body.html,
      legacyBodyHtml: redactSecrets(p.content.rendered, redactions),
      featuredMedia: featured,
      author: p.author ? `wp:user:${p.author}` : null,
      status: mapPostStatus(p.status),
      publishedAtMs: wpGmtToMs(p.date_gmt),
      modifiedAtMs: wpGmtToMs(p.modified_gmt),
      seoTitle: y.title ? decodeEntities(y.title) : null,
      seoDescription: y.description ? decodeEntities(y.description) : null,
      ogMedia: ogPath ? mediaKey(media.resolve(ogPath)) : null,
      legacyWpId: p.id,
      legacyUrl: path,
      categories: (p.categories ?? []).map((id) => `wp:category:${id}`),
      tags: (p.tags ?? []).map((id) => `wp:tag:${id}`),
    });
  }

  // ---- pages: pages.json plus the pages fetched one by one (the listing endpoint paginated them out)
  const pages = new Map<number, WpPost>();
  for (const p of snap.rest<WpPost[]>("pages.json")) pages.set(p.id, p);
  for (const id of [280, 303, 319]) {
    const f = `page_${id}.json`;
    if (snap.has(`rest/${f}`)) pages.set(id, snap.rest<WpPost>(f));
  }
  if (snap.has("rest/err_page_343.html") && !pages.has(343)) {
    parts.excluded.push({
      key: "wp:page:343",
      kind: "page",
      label: "/causes/",
      reason: (PAGE_PLAN[343] as { reason: string }).reason,
      decisionRef: "D4",
    });
  }
  for (const [id, p] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    const plan = PAGE_PLAN[id];
    const key = `wp:page:${id}`;
    if (!plan) {
      parts.warnings.push(`${key} (${p.slug}) is not in PAGE_PLAN; not imported`);
      parts.excluded.push({ key, kind: "page", label: p.slug, reason: "Unclassified page", decisionRef: null });
      continue;
    }
    if (!plan.import) {
      parts.excluded.push({ key, kind: "page", label: `/${p.slug}/`, reason: plan.reason, decisionRef: plan.decisionRef });
      continue;
    }
    const y = p.yoast_head_json ?? {};
    parts.pages.push({
      key,
      source: "wp_rest",
      sourceRef: key,
      reviewState: "verified",
      slug: plan.slug,
      title: htmlToText(p.title.rendered),
      template: plan.template,
      templateConfig: plan.config ?? null,
      status: p.status === "publish" ? "published" : "draft",
      publishedAtMs: wpGmtToMs(p.date_gmt),
      seoTitle: y.title ? decodeEntities(y.title) : null,
      seoDescription: y.description ? decodeEntities(y.description) : null,
      ogMedia: null,
      showInSitemap: true,
      legacyBodyHtml: redactSecrets(p.content.rendered, redactions),
      legacyWpId: id,
      legacyUrl: sitePath(p.link),
    });
  }

  // ---- The Events Calendar
  const eventCats = new Map<number, WpTerm>();
  for (const c of snap.rest<WpTerm[]>("tribe_events_cat.json")) eventCats.set(c.id, c);
  for (const c of eventCats.values()) parts.eventCategories.push(term(c, "event_category"));

  const venues = new Map<number, TecVenue>();
  const organizers = new Map<number, TecOrganizer>();
  for (const e of snap.rest<TecEvent[]>("tribe_events_v1.json")) {
    const key = `wp:event:${e.id}`;
    if (DEMO_EVENT_IDS.has(e.id)) {
      parts.excluded.push({ key, kind: "event", label: e.slug, reason: "Theme demo event", decisionRef: "D4" });
      continue;
    }
    const venue = Array.isArray(e.venue) ? null : e.venue;
    if (venue) venues.set(venue.id, venue);
    for (const o of e.organizer ?? []) organizers.set(o.id, o);
    const desc = sanitize(e.description);
    for (const u of desc.uploads) usage(parts, media, u.key, key, "event", u.field);
    const imgPath = e.image ? uploadsKey(e.image.url) : null;
    const featured = imgPath ? media.addReferenced(imgPath, "html_parse", `${key}:image`).key : null;
    if (featured) parts.mediaUsage.push({ media: featured, entityKey: key, entityType: "event", field: "featured" });
    parts.events.push({
      key,
      source: "wp_rest",
      sourceRef: key,
      reviewState: "verified",
      slug: percentDecode(e.slug),
      title: htmlToText(e.title),
      descriptionHtml: desc.html || null,
      legacyBodyHtml: redactSecrets(e.description, redactions) || null,
      featuredMedia: featured,
      startsAtMs: Date.parse(`${e.utc_start_date.replace(" ", "T")}Z`),
      endsAtMs: e.utc_end_date ? Date.parse(`${e.utc_end_date.replace(" ", "T")}Z`) : null,
      allDay: Boolean(e.all_day),
      timezone: e.timezone && !e.timezone.startsWith("UTC") ? e.timezone : "Asia/Kolkata",
      venue: venue ? `wp:venue:${venue.id}` : null,
      organizer: e.organizer?.[0] ? `wp:organizer:${e.organizer[0].id}` : null,
      cost: e.cost?.trim() || null,
      websiteUrl: e.website?.trim() || null,
      status: e.status === "publish" ? "published" : "draft",
      legacyWpId: e.id,
      legacyUrl: sitePath(e.url) ?? `/event/${e.slug}/`,
      categories: (e.categories ?? []).map((c) => `wp:event_category:${c.id}`),
    });
  }
  for (const v of venues.values()) {
    if (DEMO_VENUE_IDS.has(v.id)) continue;
    parts.venues.push({
      key: `wp:venue:${v.id}`,
      source: "wp_rest",
      sourceRef: `wp:venue:${v.id}`,
      reviewState: "verified",
      name: decodeEntities(v.venue),
      address: clean(v.address),
      city: clean(v.city),
      state: clean(v.province || v.state),
      country: clean(v.country),
      postalCode: clean(v.zip),
      legacyWpId: v.id,
    });
  }
  for (const v of snap.rest<{ id: number; slug: string }[]>("tribe_venue.json")) {
    if (DEMO_VENUE_IDS.has(v.id)) {
      parts.excluded.push({ key: `wp:venue:${v.id}`, kind: "venue", label: v.slug, reason: "Theme demo venue", decisionRef: "D4b" });
    } else if (!venues.has(v.id)) {
      parts.warnings.push(`wp:venue:${v.id} (${v.slug}) is not used by any imported event; not imported`);
    }
  }
  for (const o of organizers.values()) {
    parts.organizers.push({
      key: `wp:organizer:${o.id}`,
      source: "wp_rest",
      sourceRef: `wp:organizer:${o.id}`,
      reviewState: "verified",
      name: decodeEntities(o.organizer),
      phone: clean(o.phone),
      email: clean(o.email),
      website: clean(o.website),
      legacyWpId: o.id,
    });
  }
}

function term(t: WpTerm, kind: string) {
  return {
    key: `wp:${kind}:${t.id}`,
    source: "wp_rest" as const,
    sourceRef: `wp:${kind}:${t.id}`,
    reviewState: "verified" as const,
    slug: percentDecode(t.slug),
    name: decodeEntities(t.name),
    description: t.description?.trim() ? decodeEntities(t.description.trim()) : null,
    legacyWpId: t.id,
  };
}

function clean(s: string | undefined | null): string | null {
  const v = s ? decodeEntities(s).trim() : "";
  return v || null;
}

function mapPostStatus(s: string) {
  switch (s) {
    case "publish":
      return "published" as const;
    case "future":
      return "scheduled" as const;
    case "private":
      return "private" as const;
    case "pending":
      return "review" as const;
    default:
      return "draft" as const;
  }
}

/** Record that `entityKey` uses an uploads file; adds a media row for files the API does not list. */
export function usage(
  parts: BundleParts,
  media: MediaIndex,
  path: string,
  entityKey: string,
  entityType: string,
  field: string,
  source: "html_parse" | "css_parse" = "html_parse",
): string {
  const rec = media.addReferenced(path, source, `${entityKey}:${field}`);
  parts.mediaUsage.push({ media: rec.key, entityKey, entityType, field });
  return rec.key;
}

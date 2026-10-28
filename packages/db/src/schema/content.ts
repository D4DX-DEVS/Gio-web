// Content, media, URL and migration tables.
// Source of truth for the design: docs/audit/d1-schema-proposal.sql (reviewed 28 Oct 2026).
// Differences from the proposal are listed in docs/migration/IMPORTER.md ("Schema changes").
//
// Conventions (same as auth.ts): snake_case SQL names, camelCase keys, timestamps are
// INTEGER unix milliseconds. Every imported row carries provenance:
//   source       'wp_sql' | 'wp_wxr' | 'wp_rest' | 'html_parse' | 'css_parse' | 'file_probe' | 'manual'
//   source_ref   stable legacy key, e.g. 'wp:post:2938', 'html:leader:/team/#3'
//   review_state 'verified' | 'pending_client' | 'client_approved'
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const SOURCES = ["wp_sql", "wp_wxr", "wp_rest", "html_parse", "css_parse", "file_probe", "manual"] as const;
export const REVIEW_STATES = ["verified", "pending_client", "client_approved"] as const;

const ms = (name: string) => integer(name, { mode: "timestamp_ms" });

/** Provenance + timestamps shared by every content table. */
const provenance = () => ({
  source: text("source", { enum: SOURCES }).notNull().default("manual"),
  sourceRef: text("source_ref"),
  importRunId: integer("import_run_id"),
  reviewState: text("review_state", { enum: REVIEW_STATES }).notNull().default("verified"),
  createdAt: ms("created_at").notNull().default(now),
  updatedAt: ms("updated_at").notNull().default(now),
});

const reviewCheck = (table: string) =>
  check(`${table}_review_state_check`, sql.raw(`review_state IN ('verified','pending_client','client_approved')`));

// ---------------------------------------------------------------------------
// 1. Identity and audit
// ---------------------------------------------------------------------------

/** WordPress authors become bylines, never logins. */
export const authors = sqliteTable(
  "authors",
  {
    id: integer("id").primaryKey(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("authors")],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary"),
    diffJson: text("diff_json"),
    ipHash: text("ip_hash"),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [index("audit_log_entity").on(t.entityType, t.entityId, t.createdAt)],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: integer("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    userId: text("user_id"),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [index("revisions_entity").on(t.entityType, t.entityId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// 2. Media and documents
// ---------------------------------------------------------------------------

/** One row per physical file. Legacy files keep their byte-exact WordPress path as r2_key. */
export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey(),
    r2Bucket: text("r2_bucket").notNull().default("gio-media"),
    r2Key: text("r2_key").notNull().unique(),
    kind: text("kind", { enum: ["image", "document", "video", "other"] }).notNull(),
    usageHint: text("usage_hint"),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    declaredMimeType: text("declared_mime_type"),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    title: text("title"),
    credit: text("credit"),
    variantOfMediaId: integer("variant_of_media_id").references((): AnySQLiteColumn => media.id),
    variantRole: text("variant_role", { enum: ["wp_scaled", "wp_unscaled_original", "wp_pre_edit_original"] }),
    legacyWpId: integer("legacy_wp_id"),
    legacyUrl: text("legacy_url").unique(),
    /**
     * Resized copies WordPress generated for this attachment, from its attachment metadata:
     * [{ "name": "medium", "file": "x-300x200.jpg", "width": 300, "height": 200 }]. The legacy
     * resized-URL route allow-lists exactly these sizes (added to the proposal).
     */
    legacySizesJson: text("legacy_sizes_json"),
    /** 'available' once the bytes are in R2; 'missing' rows document files that could not be fetched. */
    fileStatus: text("file_status", { enum: ["available", "missing"] }).notNull().default("available"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    uploadedBy: text("uploaded_by"),
    ...provenance(),
    deletedAt: ms("deleted_at"),
  },
  (t) => [
    index("media_legacy_wp_id").on(t.legacyWpId),
    index("media_sha256").on(t.sha256),
    check("media_kind_check", sql.raw(`kind IN ('image','document','video','other')`)),
    check(
      "media_variant_role_check",
      sql.raw(`variant_role IS NULL OR variant_role IN ('wp_scaled','wp_unscaled_original','wp_pre_edit_original')`),
    ),
    check("media_file_status_check", sql.raw(`file_status IN ('available','missing')`)),
    reviewCheck("media"),
  ],
);

export const mediaUsage = sqliteTable(
  "media_usage",
  {
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    field: text("field").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.entityType, t.entityId, t.field] }),
    index("media_usage_entity").on(t.entityType, t.entityId),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey(),
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    publishedAt: ms("published_at"),
    sort: integer("sort").notNull().default(0),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("documents_media_id").on(t.mediaId),
    check("documents_status_check", sql.raw(`status IN ('draft','published','archived')`)),
    reviewCheck("documents"),
  ],
);

// ---------------------------------------------------------------------------
// 3. Editorial content
// ---------------------------------------------------------------------------

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("categories")],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("tags")],
);

export const POST_STATUSES = ["draft", "review", "scheduled", "published", "private", "archived"] as const;

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey(),
    /** Decoded UTF-8; no Unicode normalisation (05 §6.1 step 5). */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull().default(""),
    excerpt: text("excerpt"),
    bodyHtml: text("body_html").notNull(),
    bodyJson: text("body_json"),
    /** Raw content.rendered as imported. Never rendered publicly. */
    legacyBodyHtml: text("legacy_body_html"),
    featuredMediaId: integer("featured_media_id").references(() => media.id),
    authorId: integer("author_id").references(() => authors.id),
    status: text("status", { enum: POST_STATUSES }).notNull().default("draft"),
    publishedAt: ms("published_at"),
    modifiedAt: ms("modified_at"),
    locale: text("locale").notNull().default("ml"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogMediaId: integer("og_media_id").references(() => media.id),
    commentsOpen: integer("comments_open", { mode: "boolean" }).notNull().default(false),
    legacyWpId: integer("legacy_wp_id").unique(),
    legacyUrl: text("legacy_url"),
    ...provenance(),
    deletedAt: ms("deleted_at"),
  },
  (t) => [
    index("posts_status_published").on(t.status, t.publishedAt),
    check(
      "posts_status_check",
      sql.raw(`status IN ('draft','review','scheduled','published','private','archived')`),
    ),
    reviewCheck("posts"),
  ],
);

export const postCategories = sqliteTable(
  "post_categories",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const PAGE_TEMPLATES = ["sections", "leaders", "post_listing", "contact", "embed"] as const;
export const PAGE_STATUSES = ["draft", "published", "private", "archived"] as const;

export const pages = sqliteTable(
  "pages",
  {
    id: integer("id").primaryKey(),
    /** '' for the homepage. */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    template: text("template", { enum: PAGE_TEMPLATES }).notNull().default("sections"),
    templateConfig: text("template_config"),
    status: text("status", { enum: PAGE_STATUSES }).notNull().default("draft"),
    publishedAt: ms("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogMediaId: integer("og_media_id").references(() => media.id),
    showInSitemap: integer("show_in_sitemap", { mode: "boolean" }).notNull().default(true),
    /** Raw content.rendered as imported (added to the proposal for verification, like posts). */
    legacyBodyHtml: text("legacy_body_html"),
    legacyWpId: integer("legacy_wp_id").unique(),
    legacyUrl: text("legacy_url"),
    ...provenance(),
    deletedAt: ms("deleted_at"),
  },
  (t) => [
    check("pages_template_check", sql.raw(`template IN ('sections','leaders','post_listing','contact','embed')`)),
    check("pages_status_check", sql.raw(`status IN ('draft','published','private','archived')`)),
    reviewCheck("pages"),
  ],
);

// ---------------------------------------------------------------------------
// 4. Page sections: draft rows + published snapshot
// ---------------------------------------------------------------------------

export const SECTION_TYPES = [
  "hero_carousel",
  "image_banner",
  "image",
  "rich_text",
  "instagram_feed",
  "poster_slider",
  "featured_video",
  "logo_carousel",
  "embed",
  "map",
  "contact_form",
  "document_list",
  "cta",
  "latest_posts",
  "upcoming_events",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const sections = sqliteTable(
  "sections",
  {
    id: integer("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    type: text("type", { enum: SECTION_TYPES }).notNull(),
    title: text("title"),
    dataJson: text("data_json").notNull().default("{}"),
    sort: integer("sort").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    startsAt: ms("starts_at"),
    endsAt: ms("ends_at"),
    legacyRef: text("legacy_ref"),
    ...provenance(),
  },
  (t) => [
    index("sections_page_sort").on(t.pageId, t.sort),
    uniqueIndex("sections_source_ref").on(t.sourceRef),
    check("sections_type_check", sql.raw(`type IN (${SECTION_TYPES.map((s) => `'${s}'`).join(",")})`)),
    reviewCheck("sections"),
  ],
);

export const sectionItems = sqliteTable(
  "section_items",
  {
    id: integer("id").primaryKey(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").references(() => media.id),
    heading: text("heading"),
    body: text("body"),
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    openInNewTab: integer("open_in_new_tab", { mode: "boolean" }).notNull().default(false),
    altText: text("alt_text"),
    sort: integer("sort").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    startsAt: ms("starts_at"),
    endsAt: ms("ends_at"),
    ...provenance(),
  },
  (t) => [
    index("section_items_section_sort").on(t.sectionId, t.sort),
    uniqueIndex("section_items_source_ref").on(t.sourceRef),
    reviewCheck("section_items"),
  ],
);

export const publishedLayouts = sqliteTable(
  "published_layouts",
  {
    id: integer("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    layoutJson: text("layout_json").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    publishedBy: text("published_by"),
    publishedAt: ms("published_at").notNull().default(now),
  },
  (t) => [uniqueIndex("published_layouts_current").on(t.pageId).where(sql`is_current = 1`)],
);

// ---------------------------------------------------------------------------
// 5. Events (The Events Calendar)
// ---------------------------------------------------------------------------

export const venues = sqliteTable(
  "venues",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    district: text("district"),
    state: text("state"),
    country: text("country"),
    postalCode: text("postal_code"),
    /** Keyless embed URL only. The API key exposed on the old site is never copied (Q9/C17). */
    mapEmbedUrl: text("map_embed_url"),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("venues")],
);

export const organizers = sqliteTable(
  "organizers",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("organizers")],
);

export const eventCategories = sqliteTable(
  "event_categories",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    legacyWpId: integer("legacy_wp_id").unique(),
    ...provenance(),
  },
  () => [reviewCheck("event_categories")],
);

export const EVENT_STATUSES = ["draft", "scheduled", "published", "cancelled", "archived"] as const;

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    descriptionHtml: text("description_html"),
    legacyBodyHtml: text("legacy_body_html"),
    featuredMediaId: integer("featured_media_id").references(() => media.id),
    startsAt: ms("starts_at").notNull(),
    endsAt: ms("ends_at"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    venueId: integer("venue_id").references(() => venues.id),
    organizerId: integer("organizer_id").references(() => organizers.id),
    cost: text("cost"),
    websiteUrl: text("website_url"),
    registrationUrl: text("registration_url"),
    status: text("status", { enum: EVENT_STATUSES }).notNull().default("draft"),
    reportPostId: integer("report_post_id").references(() => posts.id),
    legacyWpId: integer("legacy_wp_id").unique(),
    legacyUrl: text("legacy_url"),
    ...provenance(),
    deletedAt: ms("deleted_at"),
  },
  (t) => [
    index("events_starts").on(t.status, t.startsAt),
    check("events_status_check", sql.raw(`status IN ('draft','scheduled','published','cancelled','archived')`)),
    reviewCheck("events"),
  ],
);

export const eventCategoryMap = sqliteTable(
  "event_category_map",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => eventCategories.id),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.categoryId] })],
);

// ---------------------------------------------------------------------------
// 6. Leaders
// ---------------------------------------------------------------------------

export const LEADER_SCOPES = ["state", "district", "former"] as const;
export type LeaderScope = (typeof LEADER_SCOPES)[number];

export const leaderGroups = sqliteTable(
  "leader_groups",
  {
    id: integer("id").primaryKey(),
    scope: text("scope", { enum: LEADER_SCOPES }).notNull(),
    heading: text("heading"),
    termLabel: text("term_label"),
    sort: integer("sort").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    ...provenance(),
  },
  (t) => [
    uniqueIndex("leader_groups_source_ref").on(t.sourceRef),
    index("leader_groups_scope_sort").on(t.scope, t.sort),
    check("leader_groups_scope_check", sql.raw(`scope IN ('state','district','former')`)),
    reviewCheck("leader_groups"),
  ],
);

/** One row per published entry. People are never merged across pages (Q4). */
export const leaders = sqliteTable(
  "leaders",
  {
    id: integer("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => leaderGroups.id),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    district: text("district"),
    description: text("description"),
    photoMediaId: integer("photo_media_id").references(() => media.id),
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    otherLinksJson: text("other_links_json"),
    sort: integer("sort").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    legacySourceUrl: text("legacy_source_url").notNull(),
    ...provenance(),
  },
  (t) => [
    index("leaders_group_sort").on(t.groupId, t.sort),
    uniqueIndex("leaders_source_ref").on(t.sourceRef),
    reviewCheck("leaders"),
  ],
);

// ---------------------------------------------------------------------------
// 7. Navigation, settings, forms
// ---------------------------------------------------------------------------

export const menus = sqliteTable("menus", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
});

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey(),
    menuId: integer("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references((): AnySQLiteColumn => menuItems.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url"),
    pageId: integer("page_id").references(() => pages.id, { onDelete: "set null" }),
    icon: text("icon"),
    openInNewTab: integer("open_in_new_tab", { mode: "boolean" }).notNull().default(false),
    sort: integer("sort").notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    ...provenance(),
  },
  (t) => [
    index("menu_items_menu_sort").on(t.menuId, t.parentId, t.sort),
    uniqueIndex("menu_items_source_ref").on(t.sourceRef),
    reviewCheck("menu_items"),
  ],
);

export const siteSettings = sqliteTable(
  "site_settings",
  {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    source: text("source", { enum: SOURCES }).notNull().default("manual"),
    sourceRef: text("source_ref"),
    reviewState: text("review_state", { enum: REVIEW_STATES }).notNull().default("verified"),
    updatedBy: text("updated_by"),
    updatedAt: ms("updated_at").notNull().default(now),
  },
  () => [reviewCheck("site_settings")],
);

export const contactSubmissions = sqliteTable(
  "contact_submissions",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    pageUrl: text("page_url"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    status: text("status", { enum: ["new", "read", "archived", "spam"] }).notNull().default("new"),
    isLegacy: integer("is_legacy", { mode: "boolean" }).notNull().default(false),
    createdAt: ms("created_at").notNull().default(now),
    purgeAfter: ms("purge_after"),
  },
  (t) => [
    index("contact_submissions_status").on(t.status, t.createdAt),
    check("contact_submissions_status_check", sql.raw(`status IN ('new','read','archived','spam')`)),
  ],
);

// ---------------------------------------------------------------------------
// 8. URLs
// ---------------------------------------------------------------------------

export const LEGACY_URL_ACTIONS = ["same_path", "redirect_301", "gone_410", "pending_decision"] as const;
export const DECISION_STATUSES = ["verified", "needs_client_approval", "client_approved"] as const;

export const legacyUrls = sqliteTable(
  "legacy_urls",
  {
    id: integer("id").primaryKey(),
    /** Percent-encoded exactly as WordPress emitted it (lowercase hex). */
    oldPath: text("old_path").notNull().unique(),
    oldPathDecoded: text("old_path_decoded").notNull(),
    legacyType: text("legacy_type").notNull(),
    liveStatus: integer("live_status"),
    inSitemap: text("in_sitemap"),
    action: text("action", { enum: LEGACY_URL_ACTIONS }).notNull(),
    newPath: text("new_path"),
    /** Recommended target from url_map.csv. Advisory only: never enforced until approved. */
    recommendedTarget: text("recommended_target"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    decisionStatus: text("decision_status", { enum: DECISION_STATUSES }).notNull(),
    decidedBy: text("decided_by"),
    decidedAt: ms("decided_at"),
    note: text("note"),
    lastVerifiedAt: ms("last_verified_at"),
    lastVerifiedStatus: integer("last_verified_status"),
  },
  (t) => [
    index("legacy_urls_decoded").on(t.oldPathDecoded),
    check(
      "legacy_urls_action_check",
      sql.raw(`action IN ('same_path','redirect_301','gone_410','pending_decision')`),
    ),
    check(
      "legacy_urls_decision_check",
      sql.raw(`decision_status IN ('verified','needs_client_approval','client_approved')`),
    ),
  ],
);

export const redirects = sqliteTable(
  "redirects",
  {
    id: integer("id").primaryKey(),
    fromPath: text("from_path").notNull().unique(),
    toPath: text("to_path"),
    statusCode: integer("status_code").notNull().default(301),
    origin: text("origin", { enum: ["migration", "slug_change", "manual"] }).notNull(),
    legacyUrlId: integer("legacy_url_id").references(() => legacyUrls.id),
    hits: integer("hits").notNull().default(0),
    lastHitAt: ms("last_hit_at"),
    note: text("note"),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [
    check("redirects_status_check", sql.raw(`status_code IN (301,302,308,410)`)),
    check("redirects_origin_check", sql.raw(`origin IN ('migration','slug_change','manual')`)),
    check("redirects_target_check", sql.raw(`(status_code = 410) = (to_path IS NULL)`)),
  ],
);

export const notFoundLog = sqliteTable("not_found_log", {
  path: text("path").primaryKey(),
  hits: integer("hits").notNull().default(1),
  referrer: text("referrer"),
  firstSeenAt: ms("first_seen_at").notNull(),
  lastSeenAt: ms("last_seen_at").notNull(),
});

// ---------------------------------------------------------------------------
// 9. Migration bookkeeping and client review queue
// ---------------------------------------------------------------------------

export const importRuns = sqliteTable(
  "import_runs",
  {
    id: integer("id").primaryKey(),
    sourceKind: text("source_kind").notNull(),
    sourceLabel: text("source_label").notNull(),
    sourceSha256: text("source_sha256"),
    mode: text("mode", { enum: ["dry_run", "apply", "delta"] }).notNull(),
    startedAt: ms("started_at").notNull(),
    finishedAt: ms("finished_at"),
    status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull(),
    countsJson: text("counts_json"),
    reportR2Key: text("report_r2_key"),
  },
  (t) => [
    check("import_runs_mode_check", sql.raw(`mode IN ('dry_run','apply','delta')`)),
    check("import_runs_status_check", sql.raw(`status IN ('running','succeeded','failed')`)),
  ],
);

/** Idempotency: one row per legacy object, so re-running updates instead of duplicating. */
export const importItems = sqliteTable(
  "import_items",
  {
    legacyKey: text("legacy_key").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    contentSha256: text("content_sha256").notNull(),
    /**
     * entity.updated_at written by the importer. If the row's updated_at differs on the next run,
     * an editor changed it in the admin, and the importer records a conflict instead of overwriting.
     * (Added to the proposal.)
     */
    entityUpdatedAt: ms("entity_updated_at"),
    firstRunId: integer("first_run_id")
      .notNull()
      .references(() => importRuns.id),
    lastRunId: integer("last_run_id")
      .notNull()
      .references(() => importRuns.id),
    warningsJson: text("warnings_json"),
  },
  (t) => [index("import_items_entity").on(t.entityType, t.entityId)],
);

export const importConflicts = sqliteTable(
  "import_conflicts",
  {
    id: integer("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => importRuns.id),
    legacyKey: text("legacy_key").notNull(),
    field: text("field").notNull(),
    valuesJson: text("values_json").notNull(),
    chosenSource: text("chosen_source"),
    resolvedBy: text("resolved_by"),
    resolvedAt: ms("resolved_at"),
  },
  (t) => [uniqueIndex("import_conflicts_key_field").on(t.legacyKey, t.field)],
);

export const REVIEW_ITEM_STATUSES = ["pending", "keep_as_is", "change_approved", "rejected"] as const;

/** Everything that needs a client decision. */
export const reviewItems = sqliteTable(
  "review_items",
  {
    id: integer("id").primaryKey(),
    /** Stable key so re-imports update instead of duplicating (added to the proposal). */
    reviewKey: text("review_key").notNull().unique(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    field: text("field"),
    currentValue: text("current_value"),
    /** Only when the client or evidence supplies one. Never guessed. */
    suggestedValue: text("suggested_value"),
    evidence: text("evidence"),
    status: text("status", { enum: REVIEW_ITEM_STATUSES }).notNull().default("pending"),
    decisionNote: text("decision_note"),
    decidedBy: text("decided_by"),
    decidedAt: ms("decided_at"),
    createdAt: ms("created_at").notNull().default(now),
  },
  (t) => [
    index("review_items_status").on(t.status, t.code),
    check(
      "review_items_status_check",
      sql.raw(`status IN ('pending','keep_as_is','change_approved','rejected')`),
    ),
  ],
);

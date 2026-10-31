// Staging bundle: the one normalised format every source adapter produces (05 §1, principle 2).
// The loader only reads this bundle, so it does not care which source a record came from.
import { z } from "zod";

export const Source = z.enum(["wp_sql", "wp_wxr", "wp_rest", "html_parse", "css_parse", "file_probe", "manual"]);
export type Source = z.infer<typeof Source>;

/** Merge precedence per field (05 §2.2): sql > wxr > rest > html. */
export const SOURCE_PRECEDENCE: Source[] = ["wp_sql", "wp_wxr", "wp_rest", "html_parse", "css_parse", "file_probe", "manual"];

export const ReviewState = z.enum(["verified", "pending_client", "client_approved"]);

const Prov = {
  key: z.string().min(1),
  source: Source,
  sourceRef: z.string().min(1),
  reviewState: ReviewState.default("verified"),
};

/** Reference to another bundle record by its key, resolved to a D1 id by the loader. */
const Ref = z.string().min(1).nullable();

export const AuthorRec = z.object({ ...Prov, displayName: z.string(), slug: z.string(), legacyWpId: z.number().int() });

export const TermRec = z.object({
  ...Prov,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  legacyWpId: z.number().int(),
});

export const MediaRec = z.object({
  ...Prov,
  /** Byte-exact path below the site root: 'wp-content/uploads/2025/08/bnr1.jpg'. Also the R2 key. */
  path: z.string().regex(/^wp-content\/uploads\//),
  kind: z.enum(["image", "document", "video", "other"]),
  usageHint: z.string().nullable(),
  originalFilename: z.string(),
  declaredMimeType: z.string().nullable(),
  title: z.string().nullable(),
  caption: z.string().nullable(),
  altText: z.string().nullable(),
  legacyWpId: z.number().int().nullable(),
  legacyUrl: z.string(),
  variantOf: Ref,
  variantRole: z.enum(["wp_scaled", "wp_unscaled_original", "wp_pre_edit_original"]).nullable(),
  /** Resized copies WordPress generated (attachment metadata). Empty for files the API does not list. */
  legacySizes: z.array(z.object({ name: z.string(), file: z.string(), width: z.number().int(), height: z.number().int() })),
  declaredWidth: z.number().int().nullable(),
  declaredHeight: z.number().int().nullable(),
  /** HEAD result recorded in the snapshot, if probed. */
  probedStatus: z.number().int().nullable(),
  probedBytes: z.number().int().nullable(),
  createdAtMs: z.number().int().nullable(),
});

export const MediaUsageRec = z.object({
  media: z.string(),
  entityKey: z.string(),
  entityType: z.string(),
  field: z.string(),
});

export const DocumentRec = z.object({
  ...Prov,
  media: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  publishedAtMs: z.number().int().nullable(),
  sort: z.number().int(),
});

export const PostRec = z.object({
  ...Prov,
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  bodyHtml: z.string(),
  legacyBodyHtml: z.string(),
  featuredMedia: Ref,
  author: Ref,
  status: z.enum(["draft", "review", "scheduled", "published", "private", "archived"]),
  publishedAtMs: z.number().int().nullable(),
  modifiedAtMs: z.number().int().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  ogMedia: Ref,
  legacyWpId: z.number().int(),
  legacyUrl: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
});

export const PageRec = z.object({
  ...Prov,
  slug: z.string(),
  title: z.string(),
  template: z.enum(["sections", "leaders", "post_listing", "contact", "embed"]),
  templateConfig: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(["draft", "published", "private", "archived"]),
  publishedAtMs: z.number().int().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  ogMedia: Ref,
  showInSitemap: z.boolean(),
  legacyBodyHtml: z.string().nullable(),
  legacyWpId: z.number().int().nullable(),
  legacyUrl: z.string().nullable(),
});

export const SectionRec = z.object({
  ...Prov,
  page: z.string(),
  type: z.enum([
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
  ]),
  title: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  sort: z.number().int(),
  legacyRef: z.string().nullable(),
});

export const SectionItemRec = z.object({
  ...Prov,
  section: z.string(),
  media: Ref,
  heading: z.string().nullable(),
  body: z.string().nullable(),
  linkUrl: z.string().nullable(),
  linkLabel: z.string().nullable(),
  openInNewTab: z.boolean(),
  altText: z.string().nullable(),
  sort: z.number().int(),
});

export const VenueRec = z.object({
  ...Prov,
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),
  legacyWpId: z.number().int(),
});

export const OrganizerRec = z.object({
  ...Prov,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  legacyWpId: z.number().int(),
});

export const EventRec = z.object({
  ...Prov,
  slug: z.string(),
  title: z.string(),
  descriptionHtml: z.string().nullable(),
  legacyBodyHtml: z.string().nullable(),
  featuredMedia: Ref,
  startsAtMs: z.number().int(),
  endsAtMs: z.number().int().nullable(),
  allDay: z.boolean(),
  timezone: z.string(),
  venue: Ref,
  organizer: Ref,
  cost: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  status: z.enum(["draft", "scheduled", "published", "cancelled", "archived"]),
  legacyWpId: z.number().int(),
  legacyUrl: z.string(),
  categories: z.array(z.string()),
});

export const LeaderGroupRec = z.object({
  ...Prov,
  scope: z.enum(["state", "district", "former"]),
  heading: z.string().nullable(),
  termLabel: z.string().nullable(),
  sort: z.number().int(),
});

export const LeaderRec = z.object({
  ...Prov,
  group: z.string(),
  name: z.string(),
  roleTitle: z.string().nullable(),
  district: z.string().nullable(),
  description: z.string().nullable(),
  photo: Ref,
  facebookUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  otherLinks: z.array(z.string()),
  sort: z.number().int(),
  isVisible: z.boolean(),
  legacySourceUrl: z.string(),
});

export const MenuRec = z.object({ key: z.string(), label: z.string() });

export const MenuItemRec = z.object({
  ...Prov,
  menu: z.string(),
  parent: Ref,
  label: z.string(),
  url: z.string().nullable(),
  page: Ref,
  icon: z.string().nullable(),
  openInNewTab: z.boolean(),
  sort: z.number().int(),
});

export const SettingRec = z.object({
  key: z.string(),
  value: z.unknown(),
  source: Source,
  sourceRef: z.string(),
  reviewState: ReviewState.default("verified"),
});

export const LegacyUrlRec = z.object({
  oldPath: z.string(),
  oldPathDecoded: z.string(),
  legacyType: z.string(),
  liveStatus: z.number().int().nullable(),
  inSitemap: z.string().nullable(),
  action: z.enum(["same_path", "redirect_301", "gone_410", "pending_decision"]),
  newPath: z.string().nullable(),
  recommendedTarget: z.string().nullable(),
  entityKey: z.string().nullable(),
  decisionStatus: z.enum(["verified", "needs_client_approval", "client_approved"]),
  note: z.string().nullable(),
});

export const ReviewItemRec = z.object({
  reviewKey: z.string(),
  code: z.string(),
  title: z.string(),
  entityKey: z.string().nullable(),
  field: z.string().nullable(),
  currentValue: z.string().nullable(),
  evidence: z.string().nullable(),
});

export const ConflictRec = z.object({
  key: z.string(),
  field: z.string(),
  values: z.record(z.string(), z.unknown()),
  chosenSource: z.string(),
});

/** Something found in a source and deliberately not imported, with the reason. */
export const ExcludedRec = z.object({
  key: z.string(),
  kind: z.string(),
  label: z.string(),
  reason: z.string(),
  decisionRef: z.string().nullable(),
});

export const Bundle = z.object({
  meta: z.object({
    bundleVersion: z.literal(1),
    sourceLabel: z.string(),
    sourceKinds: z.array(z.string()),
    snapshotSha256: z.string(),
    builtAt: z.string(),
    secretsRedacted: z.number().int(),
  }),
  authors: z.array(AuthorRec),
  categories: z.array(TermRec),
  tags: z.array(TermRec),
  media: z.array(MediaRec),
  mediaUsage: z.array(MediaUsageRec),
  documents: z.array(DocumentRec),
  pages: z.array(PageRec),
  sections: z.array(SectionRec),
  sectionItems: z.array(SectionItemRec),
  posts: z.array(PostRec),
  venues: z.array(VenueRec),
  organizers: z.array(OrganizerRec),
  eventCategories: z.array(TermRec),
  events: z.array(EventRec),
  leaderGroups: z.array(LeaderGroupRec),
  leaders: z.array(LeaderRec),
  menus: z.array(MenuRec),
  menuItems: z.array(MenuItemRec),
  settings: z.array(SettingRec),
  legacyUrls: z.array(LegacyUrlRec),
  reviewItems: z.array(ReviewItemRec),
  conflicts: z.array(ConflictRec),
  excluded: z.array(ExcludedRec),
  warnings: z.array(z.string()),
});

export type Bundle = z.infer<typeof Bundle>;
export type AuthorRec = z.infer<typeof AuthorRec>;
export type TermRec = z.infer<typeof TermRec>;
export type MediaRec = z.infer<typeof MediaRec>;
export type MediaUsageRec = z.infer<typeof MediaUsageRec>;
export type DocumentRec = z.infer<typeof DocumentRec>;
export type PostRec = z.infer<typeof PostRec>;
export type PageRec = z.infer<typeof PageRec>;
export type SectionRec = z.infer<typeof SectionRec>;
export type SectionItemRec = z.infer<typeof SectionItemRec>;
export type VenueRec = z.infer<typeof VenueRec>;
export type OrganizerRec = z.infer<typeof OrganizerRec>;
export type EventRec = z.infer<typeof EventRec>;
export type LeaderGroupRec = z.infer<typeof LeaderGroupRec>;
export type LeaderRec = z.infer<typeof LeaderRec>;
export type MenuItemRec = z.infer<typeof MenuItemRec>;
export type SettingRec = z.infer<typeof SettingRec>;
export type LegacyUrlRec = z.infer<typeof LegacyUrlRec>;
export type ReviewItemRec = z.infer<typeof ReviewItemRec>;
export type ConflictRec = z.infer<typeof ConflictRec>;
export type ExcludedRec = z.infer<typeof ExcludedRec>;

/** Empty bundle sections, so adapters can fill only what they provide. */
export type BundleParts = Omit<Bundle, "meta">;

export function emptyParts(): BundleParts {
  return {
    authors: [],
    categories: [],
    tags: [],
    media: [],
    mediaUsage: [],
    documents: [],
    pages: [],
    sections: [],
    sectionItems: [],
    posts: [],
    venues: [],
    organizers: [],
    eventCategories: [],
    events: [],
    leaderGroups: [],
    leaders: [],
    menus: [],
    menuItems: [],
    settings: [],
    legacyUrls: [],
    reviewItems: [],
    conflicts: [],
    excluded: [],
    warnings: [],
  };
}

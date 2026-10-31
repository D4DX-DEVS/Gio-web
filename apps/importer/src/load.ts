// `load` step (05 §3): upsert the bundle into local D1 and copy cached files into local R2.
//
// Idempotency (05 §1 principle 3): every record has a legacy key in import_items with the hash of
// the source record. Unchanged hash = skip. Changed hash = update, unless an editor changed the row
// since the last import (updated_at differs), in which case nothing is overwritten and a conflict
// is recorded. Rows that exist without an import_items entry are never touched.
import { readFileSync } from "node:fs";
import { createDb, schema as s, type Db } from "@gio/db";
import { publishPageLayout } from "@gio/db/layout";
import { and, eq, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { applyMigrations, openLocalEnv, type LocalEnv } from "./env";
import { cacheFile, type FileEntry, readManifest } from "./files";
import type { Bundle, MediaRec } from "./model";
import { hashRecord } from "./lib/util";

export interface LoadOptions {
  cacheDir: string;
  /** `<dir>/v3` holds Miniflare state. false = in-memory (tests). */
  persistDir: string | false;
  dryRun: boolean;
  log: (s: string) => void;
  /** Reuse an open environment (tests). */
  env?: LocalEnv;
  /** Fixed clock (tests). */
  now?: () => Date;
}

type Action = "inserted" | "updated" | "unchanged" | "conflict";

export interface LoadResult {
  runId: number;
  status: "succeeded" | "failed";
  counts: Record<string, Partial<Record<Action, number>>>;
  r2: { uploaded: number; alreadyPresent: number; missingBytes: number };
  conflicts: number;
}

class Loader {
  readonly ids = new Map<string, number>();
  readonly counts: LoadResult["counts"] = {};
  readonly changed = new Set<string>();
  conflicts = 0;

  constructor(
    readonly db: Db,
    readonly runId: number,
    readonly runAt: Date,
  ) {}

  private count(entity: string, a: Action) {
    const c = (this.counts[entity] ??= {});
    c[a] = (c[a] ?? 0) + 1;
  }

  async conflict(legacyKey: string, field: string, values: Record<string, unknown>) {
    this.conflicts++;
    await this.db
      .insert(s.importConflicts)
      .values({ runId: this.runId, legacyKey, field, valuesJson: JSON.stringify(values), chosenSource: "existing_row" })
      .onConflictDoUpdate({
        target: [s.importConflicts.legacyKey, s.importConflicts.field],
        set: { runId: this.runId, valuesJson: JSON.stringify(values), resolvedAt: null, resolvedBy: null },
      });
  }

  /**
   * Upsert one record into a table that has id, updated_at and import_run_id columns.
   * `natural` finds a row that already exists without an import_items entry.
   */
  async upsert<T extends SQLiteTable & { id: SQLiteColumn; updatedAt: SQLiteColumn }>(opts: {
    entity: string;
    legacyKey: string;
    table: T;
    natural: SQLiteColumn;
    naturalValue: unknown;
    values: Record<string, unknown>;
    hashInput: unknown;
  }): Promise<{ id: number | null; action: Action }> {
    const { db } = this;
    const t = opts.table as SQLiteTable & { id: SQLiteColumn; updatedAt: SQLiteColumn };
    const hash = hashRecord(opts.hashInput);
    const [item] = await db.select().from(s.importItems).where(eq(s.importItems.legacyKey, opts.legacyKey)).limit(1);

    let result: { id: number | null; action: Action };
    if (item?.entityId != null) {
      const [row] = (await db
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(eq(t.id, item.entityId))
        .limit(1)) as { id: number; updatedAt: Date }[];
      if (!row) {
        await this.conflict(opts.legacyKey, "*", { reason: "deleted in the new site; not re-created", entity: opts.entity });
        result = { id: null, action: "conflict" };
      } else if (item.contentSha256 === hash) {
        result = { id: row.id, action: "unchanged" };
      } else if (row.updatedAt.getTime() !== item.entityUpdatedAt?.getTime()) {
        await this.conflict(opts.legacyKey, "*", {
          reason: "source changed, but the row was edited in the new site since the last import; kept the edit",
          entity: opts.entity,
          newSourceHash: hash,
        });
        result = { id: row.id, action: "conflict" };
      } else {
        await db
          .update(t)
          .set({ ...opts.values, importRunId: this.runId, updatedAt: this.runAt } as never)
          .where(eq(t.id, row.id));
        await db
          .update(s.importItems)
          .set({ contentSha256: hash, entityUpdatedAt: this.runAt, lastRunId: this.runId })
          .where(eq(s.importItems.legacyKey, opts.legacyKey));
        result = { id: row.id, action: "updated" };
      }
      if (result.action !== "updated") {
        await db.update(s.importItems).set({ lastRunId: this.runId }).where(eq(s.importItems.legacyKey, opts.legacyKey));
      }
    } else {
      const [existing] = (await db.select({ id: t.id }).from(t).where(eq(opts.natural, opts.naturalValue as never)).limit(1)) as {
        id: number;
      }[];
      if (existing) {
        await this.conflict(opts.legacyKey, "*", {
          reason: "a row with the same natural key exists but was not created by the importer; not touched",
          entity: opts.entity,
          naturalValue: opts.naturalValue,
        });
        result = { id: existing.id, action: "conflict" };
      } else {
        const [row] = (await db
          .insert(t)
          .values({ ...opts.values, importRunId: this.runId, createdAt: this.runAt, updatedAt: this.runAt } as never)
          .returning({ id: t.id })) as { id: number }[];
        await db
          .insert(s.importItems)
          .values({
            legacyKey: opts.legacyKey,
            entityType: opts.entity,
            entityId: row.id,
            contentSha256: hash,
            entityUpdatedAt: this.runAt,
            firstRunId: this.runId,
            lastRunId: this.runId,
          })
          .onConflictDoUpdate({
            target: s.importItems.legacyKey,
            set: { entityId: row.id, contentSha256: hash, entityUpdatedAt: this.runAt, lastRunId: this.runId },
          });
        result = { id: row.id, action: "inserted" };
      }
    }
    this.count(opts.entity, result.action);
    if (result.id !== null) this.ids.set(opts.legacyKey, result.id);
    if (result.action === "inserted" || result.action === "updated") this.changed.add(opts.legacyKey);
    return result;
  }

  id(key: string | null | undefined): number | null {
    if (!key) return null;
    return this.ids.get(key) ?? null;
  }
}

const date = (ms: number | null | undefined) => (ms == null ? null : new Date(ms));

export async function loadBundle(bundle: Bundle, opts: LoadOptions): Promise<LoadResult> {
  const own = !opts.env;
  const proxy = opts.env ? null : await openLocalEnv(opts.dryRun ? false : opts.persistDir);
  const env = opts.env ?? proxy!.env;
  try {
    const applied = await applyMigrations(env);
    if (applied.length) opts.log(`load: applied migrations ${applied.join(", ")}`);
    if (opts.dryRun) opts.log("load: dry run, loading into a throwaway in-memory database");
    return await run(bundle, env, opts);
  } finally {
    if (own) await proxy!.dispose();
  }
}

async function run(bundle: Bundle, env: LocalEnv, opts: LoadOptions): Promise<LoadResult> {
  const db = createDb(env.DB);
  const runAt = opts.now?.() ?? new Date();
  const [runRow] = await db
    .insert(s.importRuns)
    .values({
      sourceKind: bundle.meta.sourceKinds.join("+"),
      sourceLabel: bundle.meta.sourceLabel,
      sourceSha256: bundle.meta.snapshotSha256,
      mode: opts.dryRun ? "dry_run" : "apply",
      startedAt: runAt,
      status: "running",
    })
    .returning({ id: s.importRuns.id });
  const L = new Loader(db, runRow.id, runAt);
  const r2 = { uploaded: 0, alreadyPresent: 0, missingBytes: 0 };

  try {
    // ---- authors
    for (const a of bundle.authors) {
      await L.upsert({
        entity: "author",
        legacyKey: a.key,
        table: s.authors,
        natural: s.authors.legacyWpId,
        naturalValue: a.legacyWpId,
        values: { displayName: a.displayName, slug: a.slug, legacyWpId: a.legacyWpId, source: a.source, sourceRef: a.sourceRef, reviewState: a.reviewState },
        hashInput: a,
      });
    }

    // ---- media + R2. Primary files first, so variants can reference them.
    const manifest = readManifest(opts.cacheDir);
    const ordered = [...bundle.media.filter((m) => !m.variantOf), ...bundle.media.filter((m) => m.variantOf)];
    for (const m of ordered) {
      const f = manifest[m.path];
      if (f?.status === "available") {
        const put = await putFile(env, opts.cacheDir, m, f);
        if (put) r2.uploaded++;
        else r2.alreadyPresent++;
      } else r2.missingBytes++;
      await L.upsert({
        entity: "media",
        legacyKey: m.key,
        table: s.media,
        natural: s.media.r2Key,
        naturalValue: m.path,
        values: mediaValues(m, f, L),
        hashInput: { m, f: f ? { ...f, fetchedAt: undefined } : null },
      });
    }

    // ---- documents
    for (const d of bundle.documents) {
      const mediaId = L.id(d.media);
      if (!mediaId) continue;
      await L.upsert({
        entity: "document",
        legacyKey: d.key,
        table: s.documents,
        natural: s.documents.mediaId,
        naturalValue: mediaId,
        values: {
          mediaId,
          title: d.title,
          description: d.description,
          category: d.category,
          status: d.status,
          publishedAt: date(d.publishedAtMs),
          sort: d.sort,
          source: d.source,
          sourceRef: d.sourceRef,
          reviewState: d.reviewState,
        },
        hashInput: d,
      });
    }

    // ---- taxonomies
    for (const [entity, list, table] of [
      ["category", bundle.categories, s.categories],
      ["tag", bundle.tags, s.tags],
      ["event_category", bundle.eventCategories, s.eventCategories],
    ] as const) {
      for (const t of list) {
        await L.upsert({
          entity,
          legacyKey: t.key,
          table,
          natural: table.legacyWpId,
          naturalValue: t.legacyWpId,
          values: {
            slug: t.slug,
            name: t.name,
            ...(entity === "category" ? { description: t.description } : {}),
            legacyWpId: t.legacyWpId,
            source: t.source,
            sourceRef: t.sourceRef,
            reviewState: t.reviewState,
          },
          hashInput: t,
        });
      }
    }

    // ---- pages
    for (const p of bundle.pages) {
      const cfg = p.templateConfig ? { ...p.templateConfig } : null;
      // Media references inside template_config are stored as D1 ids.
      if (cfg && typeof cfg.headerImage === "string") cfg.headerImageMediaId = L.id(cfg.headerImage as string);
      if (cfg) delete cfg.headerImage;
      await L.upsert({
        entity: "page",
        legacyKey: p.key,
        table: s.pages,
        natural: s.pages.slug,
        naturalValue: p.slug,
        values: {
          slug: p.slug,
          title: p.title,
          template: p.template,
          templateConfig: cfg ? JSON.stringify(cfg) : null,
          status: p.status,
          publishedAt: date(p.publishedAtMs),
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          ogMediaId: L.id(p.ogMedia),
          showInSitemap: p.showInSitemap,
          legacyBodyHtml: p.legacyBodyHtml,
          legacyWpId: p.legacyWpId,
          legacyUrl: p.legacyUrl,
          source: p.source,
          sourceRef: p.sourceRef,
          reviewState: p.reviewState,
        },
        hashInput: { ...p, templateConfig: cfg },
      });
    }

    // ---- sections and items
    for (const sec of bundle.sections) {
      const pageId = L.id(sec.page);
      if (!pageId) continue;
      await L.upsert({
        entity: "section",
        legacyKey: sec.key,
        table: s.sections,
        natural: s.sections.sourceRef,
        naturalValue: sec.sourceRef,
        values: {
          pageId,
          type: sec.type,
          title: sec.title,
          dataJson: JSON.stringify(sec.data),
          sort: sec.sort,
          legacyRef: sec.legacyRef,
          source: sec.source,
          sourceRef: sec.sourceRef,
          reviewState: sec.reviewState,
        },
        hashInput: sec,
      });
    }
    for (const it of bundle.sectionItems) {
      const sectionId = L.id(it.section);
      if (!sectionId) continue;
      await L.upsert({
        entity: "section_item",
        legacyKey: it.key,
        table: s.sectionItems,
        natural: s.sectionItems.sourceRef,
        naturalValue: it.sourceRef,
        values: {
          sectionId,
          mediaId: L.id(it.media),
          heading: it.heading,
          body: it.body,
          linkUrl: it.linkUrl,
          linkLabel: it.linkLabel,
          openInNewTab: it.openInNewTab,
          altText: it.altText,
          sort: it.sort,
          source: it.source,
          sourceRef: it.sourceRef,
          reviewState: it.reviewState,
        },
        hashInput: { ...it, mediaId: L.id(it.media) },
      });
    }

    // ---- posts and their terms
    for (const p of bundle.posts) {
      const r = await L.upsert({
        entity: "post",
        legacyKey: p.key,
        table: s.posts,
        natural: s.posts.legacyWpId,
        naturalValue: p.legacyWpId,
        values: {
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          bodyHtml: p.bodyHtml,
          legacyBodyHtml: p.legacyBodyHtml,
          featuredMediaId: L.id(p.featuredMedia),
          authorId: L.id(p.author),
          status: p.status,
          publishedAt: date(p.publishedAtMs),
          modifiedAt: date(p.modifiedAtMs),
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          ogMediaId: L.id(p.ogMedia),
          legacyWpId: p.legacyWpId,
          legacyUrl: p.legacyUrl,
          source: p.source,
          sourceRef: p.sourceRef,
          reviewState: p.reviewState,
        },
        hashInput: p,
      });
      if (r.id && (r.action === "inserted" || r.action === "updated")) {
        await db.delete(s.postCategories).where(eq(s.postCategories.postId, r.id));
        await db.delete(s.postTags).where(eq(s.postTags.postId, r.id));
        const cats = p.categories.map((k) => L.id(k)).filter((x): x is number => x !== null);
        const tags = p.tags.map((k) => L.id(k)).filter((x): x is number => x !== null);
        if (cats.length) await db.insert(s.postCategories).values(cats.map((categoryId) => ({ postId: r.id!, categoryId })));
        if (tags.length) await db.insert(s.postTags).values(tags.map((tagId) => ({ postId: r.id!, tagId })));
      }
    }

    // ---- events
    for (const v of bundle.venues) {
      await L.upsert({
        entity: "venue",
        legacyKey: v.key,
        table: s.venues,
        natural: s.venues.legacyWpId,
        naturalValue: v.legacyWpId,
        values: { name: v.name, address: v.address, city: v.city, state: v.state, country: v.country, postalCode: v.postalCode, legacyWpId: v.legacyWpId, source: v.source, sourceRef: v.sourceRef, reviewState: v.reviewState },
        hashInput: v,
      });
    }
    for (const o of bundle.organizers) {
      await L.upsert({
        entity: "organizer",
        legacyKey: o.key,
        table: s.organizers,
        natural: s.organizers.legacyWpId,
        naturalValue: o.legacyWpId,
        values: { name: o.name, phone: o.phone, email: o.email, website: o.website, legacyWpId: o.legacyWpId, source: o.source, sourceRef: o.sourceRef, reviewState: o.reviewState },
        hashInput: o,
      });
    }
    for (const e of bundle.events) {
      const r = await L.upsert({
        entity: "event",
        legacyKey: e.key,
        table: s.events,
        natural: s.events.legacyWpId,
        naturalValue: e.legacyWpId,
        values: {
          slug: e.slug,
          title: e.title,
          descriptionHtml: e.descriptionHtml,
          legacyBodyHtml: e.legacyBodyHtml,
          featuredMediaId: L.id(e.featuredMedia),
          startsAt: new Date(e.startsAtMs),
          endsAt: date(e.endsAtMs),
          allDay: e.allDay,
          timezone: e.timezone,
          venueId: L.id(e.venue),
          organizerId: L.id(e.organizer),
          cost: e.cost,
          websiteUrl: e.websiteUrl,
          status: e.status,
          legacyWpId: e.legacyWpId,
          legacyUrl: e.legacyUrl,
          source: e.source,
          sourceRef: e.sourceRef,
          reviewState: e.reviewState,
        },
        hashInput: e,
      });
      if (r.id && (r.action === "inserted" || r.action === "updated")) {
        await db.delete(s.eventCategoryMap).where(eq(s.eventCategoryMap.eventId, r.id));
        const cats = e.categories.map((k) => L.id(k)).filter((x): x is number => x !== null);
        if (cats.length) await db.insert(s.eventCategoryMap).values(cats.map((categoryId) => ({ eventId: r.id!, categoryId })));
      }
    }

    // ---- leaders
    for (const g of bundle.leaderGroups) {
      await L.upsert({
        entity: "leader_group",
        legacyKey: g.key,
        table: s.leaderGroups,
        natural: s.leaderGroups.sourceRef,
        naturalValue: g.sourceRef,
        values: { scope: g.scope, heading: g.heading, termLabel: g.termLabel, sort: g.sort, source: g.source, sourceRef: g.sourceRef, reviewState: g.reviewState },
        hashInput: g,
      });
    }
    for (const l of bundle.leaders) {
      const groupId = L.id(l.group);
      if (!groupId) continue;
      await L.upsert({
        entity: "leader",
        legacyKey: l.key,
        table: s.leaders,
        natural: s.leaders.sourceRef,
        naturalValue: l.sourceRef,
        values: {
          groupId,
          name: l.name,
          roleTitle: l.roleTitle,
          district: l.district,
          description: l.description,
          photoMediaId: L.id(l.photo),
          facebookUrl: l.facebookUrl,
          instagramUrl: l.instagramUrl,
          otherLinksJson: l.otherLinks.length ? JSON.stringify(l.otherLinks) : null,
          sort: l.sort,
          isVisible: l.isVisible,
          legacySourceUrl: l.legacySourceUrl,
          source: l.source,
          sourceRef: l.sourceRef,
          reviewState: l.reviewState,
        },
        hashInput: { ...l, groupId },
      });
    }

    // ---- menus (parents before children)
    for (const m of bundle.menus) {
      await db.insert(s.menus).values(m).onConflictDoNothing({ target: s.menus.key });
    }
    const menuIds = new Map((await db.select().from(s.menus)).map((m) => [m.key, m.id]));
    for (const mi of [...bundle.menuItems.filter((i) => !i.parent), ...bundle.menuItems.filter((i) => i.parent)]) {
      await L.upsert({
        entity: "menu_item",
        legacyKey: mi.key,
        table: s.menuItems,
        natural: s.menuItems.sourceRef,
        naturalValue: mi.sourceRef,
        values: {
          menuId: menuIds.get(mi.menu)!,
          parentId: L.id(mi.parent),
          label: mi.label,
          url: mi.url,
          pageId: L.id(mi.page),
          icon: mi.icon,
          openInNewTab: mi.openInNewTab,
          sort: mi.sort,
          source: mi.source,
          sourceRef: mi.sourceRef,
          reviewState: mi.reviewState,
        },
        hashInput: mi,
      });
    }

    // ---- site settings: inserted once; later imports never overwrite an edited value
    for (const st of bundle.settings) {
      const value = st.key.endsWith("_media") && typeof st.value === "string" ? L.id(st.value) : st.value;
      const res = await db
        .insert(s.siteSettings)
        .values({ key: st.key, valueJson: JSON.stringify(value), source: st.source, sourceRef: st.sourceRef, reviewState: st.reviewState, updatedBy: "importer", updatedAt: runAt })
        .onConflictDoUpdate({
          target: s.siteSettings.key,
          set: { valueJson: JSON.stringify(value), sourceRef: st.sourceRef, updatedAt: runAt },
          setWhere: sql`${s.siteSettings.updatedBy} = 'importer'`,
        })
        .returning({ key: s.siteSettings.key });
      L.counts.site_setting ??= {};
      const k = res.length ? "updated" : "conflict";
      L.counts.site_setting[k] = (L.counts.site_setting[k] ?? 0) + 1;
    }

    // ---- media usage (rebuilt for every entity this run inserted or updated)
    const usageEntityId = (key: string) => L.id(key) ?? (key.startsWith("setting:") ? key.slice(8) : key);
    const changedEntities = bundle.mediaUsage.filter((u) => L.changed.has(u.entityKey) || !L.ids.has(u.entityKey));
    for (const u of changedEntities) {
      await db
        .delete(s.mediaUsage)
        .where(and(eq(s.mediaUsage.entityType, u.entityType), eq(s.mediaUsage.entityId, String(usageEntityId(u.entityKey)))));
    }
    for (const u of changedEntities) {
      const mediaId = L.id(u.media);
      if (!mediaId) continue;
      await db
        .insert(s.mediaUsage)
        .values({ mediaId, entityType: u.entityType, entityId: String(usageEntityId(u.entityKey)), field: u.field })
        .onConflictDoNothing();
    }

    // ---- legacy URLs. Decisions made in the admin (client_approved) are never overwritten.
    const entityTypeOf = (k: string | null) => (k ? k.split(":")[1] : null);
    for (const u of bundle.legacyUrls) {
      const values = {
        oldPath: u.oldPath,
        oldPathDecoded: u.oldPathDecoded,
        legacyType: u.legacyType,
        liveStatus: u.liveStatus,
        inSitemap: u.inSitemap,
        action: u.action,
        newPath: u.newPath,
        recommendedTarget: u.recommendedTarget,
        entityType: entityTypeOf(u.entityKey),
        entityId: L.id(u.entityKey),
        decisionStatus: u.decisionStatus,
        note: u.note,
      };
      const { oldPath, action, newPath, decisionStatus, ...refresh } = values;
      await db
        .insert(s.legacyUrls)
        .values(values)
        .onConflictDoUpdate({
          target: s.legacyUrls.oldPath,
          set: refresh,
          setWhere: sql`${s.legacyUrls.decisionStatus} <> 'client_approved'`,
        });
    }
    L.counts.legacy_url = { inserted: bundle.legacyUrls.length };

    // ---- review queue. Decided items keep their decision; pending ones get the latest evidence.
    for (const r of bundle.reviewItems) {
      const entityId = r.entityKey?.startsWith("legacy_url:") ? r.entityKey.slice(11) : (L.id(r.entityKey) ?? null);
      const values = {
        reviewKey: r.reviewKey,
        code: r.code,
        title: r.title,
        entityType: r.entityKey ? (r.entityKey.startsWith("legacy_url:") ? "legacy_url" : r.entityKey.split(":")[1] ?? null) : null,
        entityId: entityId === null ? null : String(entityId),
        field: r.field,
        currentValue: r.currentValue,
        evidence: r.evidence,
      };
      await db
        .insert(s.reviewItems)
        .values({ ...values, createdAt: runAt })
        .onConflictDoUpdate({ target: s.reviewItems.reviewKey, set: values, setWhere: sql`${s.reviewItems.status} = 'pending'` });
    }
    L.counts.review_item = { inserted: bundle.reviewItems.length };

    // ---- publish section pages whose draft changed, unless an editor published since the import
    const sectionPages = bundle.pages.filter((p) => p.template === "sections");
    let published = 0;
    for (const p of sectionPages) {
      const pageId = L.id(p.key);
      if (!pageId) continue;
      const touched =
        L.changed.has(p.key) ||
        bundle.sections.some((x) => x.page === p.key && L.changed.has(x.key)) ||
        bundle.sectionItems.some((i) => L.changed.has(i.key) && bundle.sections.find((x) => x.key === i.section)?.page === p.key);
      const [current] = await db
        .select({ publishedBy: s.publishedLayouts.publishedBy })
        .from(s.publishedLayouts)
        .where(and(eq(s.publishedLayouts.pageId, pageId), eq(s.publishedLayouts.isCurrent, true)))
        .limit(1);
      if (current && current.publishedBy !== "importer") continue;
      if (!current || touched) {
        await publishPageLayout(db, pageId, "importer");
        published++;
      }
    }
    L.counts.published_layout = { inserted: published };

    // Unreferenced import rows from earlier runs (records that vanished from the source) are reported, not deleted.
    const keys = new Set([
      ...bundle.authors, ...bundle.media, ...bundle.documents, ...bundle.categories, ...bundle.tags, ...bundle.eventCategories,
      ...bundle.pages, ...bundle.sections, ...bundle.sectionItems, ...bundle.posts, ...bundle.venues, ...bundle.organizers,
      ...bundle.events, ...bundle.leaderGroups, ...bundle.leaders, ...bundle.menuItems,
    ].map((r) => r.key));
    const stale = (await db.select({ k: s.importItems.legacyKey }).from(s.importItems)).filter((r) => !keys.has(r.k));
    for (const st of stale) await L.conflict(st.k, "*", { reason: "no longer present in the source; kept" });

    await db
      .update(s.importRuns)
      .set({ status: "succeeded", finishedAt: new Date(), countsJson: JSON.stringify({ ...L.counts, r2 }) })
      .where(eq(s.importRuns.id, L.runId));
    await env.PRIVATE.put(`migration-reports/run-${L.runId}/bundle-meta.json`, JSON.stringify(bundle.meta, null, 1), {
      httpMetadata: { contentType: "application/json" },
    });
    return { runId: L.runId, status: "succeeded", counts: L.counts, r2, conflicts: L.conflicts };
  } catch (e) {
    await db
      .update(s.importRuns)
      .set({ status: "failed", finishedAt: new Date(), countsJson: JSON.stringify({ ...L.counts, error: String(e) }) })
      .where(eq(s.importRuns.id, L.runId));
    throw e;
  }
}

function mediaValues(m: MediaRec, f: FileEntry | undefined, L: Loader) {
  const available = f?.status === "available";
  return {
    r2Bucket: "gio-media",
    r2Key: m.path,
    kind: m.kind,
    usageHint: m.usageHint,
    originalFilename: m.originalFilename,
    mimeType: (available ? f.mime : null) ?? m.declaredMimeType ?? "application/octet-stream",
    declaredMimeType: m.declaredMimeType,
    byteSize: available ? f.bytes! : 0,
    width: (available ? f.width : null) ?? m.declaredWidth,
    height: (available ? f.height : null) ?? m.declaredHeight,
    sha256: available ? f.sha256! : "",
    altText: m.altText,
    caption: m.caption,
    title: m.title,
    variantOfMediaId: L.id(m.variantOf),
    variantRole: m.variantRole,
    legacyWpId: m.legacyWpId,
    legacyUrl: m.legacyUrl,
    legacySizesJson: m.legacySizes.length ? JSON.stringify(m.legacySizes) : null,
    fileStatus: available ? ("available" as const) : ("missing" as const),
    source: m.source,
    sourceRef: m.sourceRef,
    reviewState: m.reviewState,
  };
}

/** Put a cached file into local R2 if it is absent or its hash differs. Returns true if written. */
async function putFile(env: LocalEnv, cacheDir: string, m: MediaRec, f: FileEntry): Promise<boolean> {
  const head = await retry(() => env.MEDIA.head(m.path));
  if (head?.customMetadata?.sha256 === f.sha256) return false;
  const bytes = readFileSync(cacheFile(cacheDir, m.path));
  await retry(() =>
    env.MEDIA.put(m.path, bytes, {
      httpMetadata: { contentType: f.mime ?? "application/octet-stream" },
      customMetadata: { sha256: f.sha256!, source: m.source, legacyUrl: m.legacyUrl },
    }),
  );
  return true;
}

/** The Miniflare proxy occasionally drops a large transfer (ECONNRESET); writes are idempotent, so retry. */
async function retry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}


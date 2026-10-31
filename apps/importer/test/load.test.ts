// Loads a trimmed real bundle into an in-memory local D1/R2 (Miniflare) and checks idempotency,
// duplicate prevention and that editor changes are never overwritten by a re-import.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createDb, schema as s } from "@gio/db";
import { currentPageLayout } from "@gio/db/layout";
import { count, eq } from "drizzle-orm";
import { buildBundle } from "../src/build";
import { applyMigrations, openLocalEnv } from "../src/env";
import { cacheFile, type Manifest, manifestPath } from "../src/files";
import { loadBundle } from "../src/load";
import type { Bundle } from "../src/model";
import { sha256 } from "../src/lib/util";
import { SNAPSHOT, URL_MAP } from "./build.test";

const skip = !existsSync(SNAPSHOT) && "frozen snapshot not present (git-ignored)";

/** Homepage + 3 posts + the state leaders + everything they reference. */
function trim(b: Bundle): Bundle {
  const posts = b.posts.slice(0, 3);
  const sections = b.sections.filter((x) => x.page === "wp:page:2074");
  const items = b.sectionItems.filter((i) => sections.some((x) => x.key === i.section));
  const groups = b.leaderGroups.filter((g) => g.scope === "state");
  const leaders = b.leaders.filter((l) => groups.some((g) => g.key === l.group));
  const wanted = new Set([...posts.map((p) => p.featuredMedia), ...items.map((i) => i.media), ...leaders.map((l) => l.photo)]);
  const media = b.media.filter((m) => wanted.has(m.key));
  return {
    ...b,
    posts,
    pages: b.pages.filter((p) => p.legacyWpId === 2074 || p.legacyWpId === 303),
    sections,
    sectionItems: items,
    leaderGroups: groups,
    leaders,
    media,
    documents: [],
    mediaUsage: b.mediaUsage.filter((u) => wanted.has(u.media)),
    reviewItems: b.reviewItems.filter((r) => ["Q1", "Q3", "D4"].includes(r.code)).slice(0, 10),
  };
}

describe("load into local D1/R2", { skip }, () => {
  let proxy: Awaited<ReturnType<typeof openLocalEnv>>;
  let bundle: Bundle;
  let cacheDir: string;
  const quiet = () => {};

  before(async () => {
    proxy = await openLocalEnv(false);
    await applyMigrations(proxy.env);
    bundle = trim(buildBundle({ snapshotDir: SNAPSHOT, urlMapCsv: URL_MAP }));
    // A fake cache with two "downloaded" files; the rest stay missing.
    cacheDir = mkdtempSync(join(tmpdir(), "gio-cache-"));
    const manifest: Manifest = {};
    for (const m of bundle.media.slice(0, 2)) {
      const bytes = new TextEncoder().encode(`fake bytes for ${m.path}`);
      mkdirSync(join(cacheFile(cacheDir, m.path), ".."), { recursive: true });
      writeFileSync(cacheFile(cacheDir, m.path), bytes);
      manifest[m.path] = { path: m.path, status: "available", httpStatus: 200, bytes: bytes.length, sha256: sha256(bytes), mime: "image/jpeg", width: 10, height: 10, contentLength: bytes.length, auditBytes: null, fetchedAt: null, note: null };
    }
    writeFileSync(manifestPath(cacheDir), JSON.stringify(manifest));
  });
  after(async () => proxy?.dispose());

  const load = (b: Bundle) => loadBundle(b, { cacheDir, persistDir: false, dryRun: false, log: quiet, env: proxy.env });
  const rows = async (t: Parameters<ReturnType<typeof createDb>["select"]>[0] extends never ? never : any) =>
    (await createDb(proxy.env.DB).select({ c: count() }).from(t))[0].c;

  it("applies migrations once (second apply is a no-op)", async () => {
    assert.deepEqual(await applyMigrations(proxy.env), []);
  });

  it("first load inserts every record and publishes the homepage layout", async () => {
    const r = await load(bundle);
    assert.equal(r.status, "succeeded");
    assert.equal(r.counts.post.inserted, 3);
    assert.equal(r.counts.leader.inserted, 29);
    assert.equal(r.r2.uploaded, 2);
    const db = createDb(proxy.env.DB);
    const [home] = await db.select().from(s.pages).where(eq(s.pages.legacyWpId, 2074));
    const layout = await currentPageLayout(db, home.id);
    assert.equal(layout?.sections.length, 9);
    assert.deepEqual(layout!.sections.map((x) => x.type).slice(0, 2), ["hero_carousel", "image_banner"]);
    const missing = await db.select({ c: count() }).from(s.media).where(eq(s.media.fileStatus, "missing"));
    assert.equal(missing[0].c, bundle.media.length - 2);
  });

  it("second load changes nothing and creates no duplicates", async () => {
    const before = [await rows(s.posts), await rows(s.leaders), await rows(s.media), await rows(s.sections), await rows(s.legacyUrls), await rows(s.reviewItems), await rows(s.publishedLayouts)];
    const r = await load(bundle);
    assert.equal(r.counts.post.unchanged, 3);
    assert.equal(r.counts.post.inserted, undefined);
    assert.equal(r.counts.leader.unchanged, 29);
    assert.equal(r.r2.uploaded, 0);
    assert.equal(r.r2.alreadyPresent, 2);
    const afterCounts = [await rows(s.posts), await rows(s.leaders), await rows(s.media), await rows(s.sections), await rows(s.legacyUrls), await rows(s.reviewItems), await rows(s.publishedLayouts)];
    assert.deepEqual(afterCounts, before);
  });

  it("updates a record whose source changed when nobody edited it", async () => {
    const changed = structuredClone(bundle);
    changed.posts[1].excerpt = "changed in source";
    const r = await load(changed);
    assert.equal(r.counts.post.updated, 1);
    const [p] = await createDb(proxy.env.DB).select().from(s.posts).where(eq(s.posts.legacyWpId, bundle.posts[1].legacyWpId));
    assert.equal(p.excerpt, "changed in source");
  });

  it("never overwrites an editor's change; records a conflict instead", async () => {
    const db = createDb(proxy.env.DB);
    const wp = bundle.posts[0].legacyWpId;
    await db.update(s.posts).set({ title: "Edited in admin", updatedAt: new Date(Date.now() + 1000) }).where(eq(s.posts.legacyWpId, wp));
    const changed = structuredClone(bundle);
    changed.posts[0].title = "Changed in WordPress";
    const r = await load(changed);
    assert.equal(r.counts.post.conflict, 1);
    const [p] = await db.select().from(s.posts).where(eq(s.posts.legacyWpId, wp));
    assert.equal(p.title, "Edited in admin");
    const conflicts = await db.select().from(s.importConflicts).where(eq(s.importConflicts.legacyKey, `wp:post:${wp}`));
    assert.equal(conflicts.length, 1);
  });

  it("keeps client decisions on review items and legacy URLs", async () => {
    const db = createDb(proxy.env.DB);
    const item = bundle.reviewItems[0];
    await db.update(s.reviewItems).set({ status: "keep_as_is", decidedBy: "client" }).where(eq(s.reviewItems.reviewKey, item.reviewKey));
    const pending = bundle.legacyUrls.find((u) => u.action === "pending_decision")!;
    await db.update(s.legacyUrls).set({ action: "gone_410", decisionStatus: "client_approved" }).where(eq(s.legacyUrls.oldPath, pending.oldPath));
    await load(bundle);
    const [ri] = await db.select().from(s.reviewItems).where(eq(s.reviewItems.reviewKey, item.reviewKey));
    assert.equal(ri.status, "keep_as_is");
    const [lu] = await db.select().from(s.legacyUrls).where(eq(s.legacyUrls.oldPath, pending.oldPath));
    assert.equal(lu.action, "gone_410");
    assert.equal(lu.decisionStatus, "client_approved");
  });

  it("does not re-create a record deleted in the new site", async () => {
    const db = createDb(proxy.env.DB);
    const wp = bundle.posts[2].legacyWpId;
    const [p] = await db.select().from(s.posts).where(eq(s.posts.legacyWpId, wp));
    await db.delete(s.postCategories).where(eq(s.postCategories.postId, p.id));
    await db.delete(s.postTags).where(eq(s.postTags.postId, p.id));
    await db.delete(s.posts).where(eq(s.posts.id, p.id));
    const r = await load(bundle);
    // Only the deleted post conflicts; the edited one matches its last-imported source again.
    assert.equal(r.counts.post.conflict, 1);
    assert.equal((await db.select().from(s.posts).where(eq(s.posts.legacyWpId, wp))).length, 0);
  });

  it("enforces the schema's CHECK constraints", async () => {
    await assert.rejects(
      proxy.env.DB.prepare("INSERT INTO review_items (review_key, code, title, status, created_at) VALUES ('x','X','t','maybe',0)").run(),
    );
  });
});

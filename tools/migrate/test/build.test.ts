// Builds the bundle from the real frozen snapshot (git-ignored; skipped when absent).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildBundle } from "../src/build";
import { containsSecret, hashRecord, wpEncodePath } from "../src/lib/util";

const ROOT = join(import.meta.dirname, "../../..");
export const SNAPSHOT = join(ROOT, "migration/snapshot-2026-10-27");
export const URL_MAP = join(ROOT, "docs/audit/inventory/url_map.csv");
const skip = !existsSync(SNAPSHOT) && "frozen snapshot not present (git-ignored)";

describe("build from the frozen snapshot", { skip }, () => {
  const bundle = skip ? null! : buildBundle({ snapshotDir: SNAPSHOT, urlMapCsv: URL_MAP });

  it("produces the audited counts", () => {
    assert.equal(bundle.posts.length, 34);
    assert.equal(bundle.pages.length, 11);
    assert.equal(bundle.leaders.length, 123);
    assert.equal(bundle.events.length, 2);
    assert.equal(bundle.sections.filter((s) => s.page === "wp:page:2074").length, 9);
    assert.equal(bundle.legacyUrls.length, 139);
    assert.equal(bundle.warnings.length, 0, bundle.warnings.join("\n"));
  });

  it("keeps every post URL byte for byte", () => {
    for (const p of bundle.posts) assert.equal(wpEncodePath(`/${p.slug}/`), p.legacyUrl, p.key);
  });

  it("imports content as published: the untitled post stays untitled and is flagged", () => {
    const p = bundle.posts.find((x) => x.legacyWpId === 2577)!;
    assert.equal(p.title, "");
    assert.equal(p.reviewState, "pending_client");
    assert.ok(bundle.reviewItems.some((r) => r.code === "Q1" && r.entityKey === p.key));
  });

  it("never proposes corrections", () => {
    for (const r of bundle.reviewItems) assert.equal((r as { suggestedValue?: string }).suggestedValue, undefined);
  });

  it("does not import theme-demo content and records why", () => {
    assert.ok(!bundle.events.some((e) => e.legacyWpId === 636));
    assert.ok(!bundle.tags.some((t) => ["charity", "donation", "poor"].includes(t.slug)));
    assert.ok(bundle.excluded.some((e) => e.key === "wp:event:636" && e.decisionRef === "D4"));
    assert.equal(bundle.reviewItems.filter((r) => r.code === "D4" || r.code === "D4a").length, 70);
  });

  it("does not merge people across pages", () => {
    const shifana = bundle.leaders.filter((l) => l.name === "SHIFANA K");
    assert.equal(shifana.length, 3);
    assert.equal(new Set(shifana.map((l) => l.key)).size, 3);
  });

  it("contains no API key", () => {
    assert.ok(!containsSecret(JSON.stringify(bundle)));
  });

  it("is deterministic", () => {
    const again = buildBundle({ snapshotDir: SNAPSHOT, urlMapCsv: URL_MAP });
    const strip = (b: typeof bundle) => ({ ...b, meta: { ...b.meta, builtAt: "" } });
    assert.equal(hashRecord(strip(again)), hashRecord(strip(bundle)));
  });
});

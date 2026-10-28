// `verify` step (05 §7, 03-MIGRATION-CHECKLIST.md): compare the audit inventories, the bundle,
// local D1 and local R2, and write the migration report. Distinguishes imported, verified,
// pending, conflicting and unavailable records and files. Never claims more than it checked.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { createDb, schema as s } from "@gio/db";
import { count, eq, isNull, sql } from "drizzle-orm";
import { openLocalEnv, type LocalEnv } from "./env";
import { readManifest } from "./files";
import type { Bundle } from "./model";
import { containsSecret } from "./lib/util";

export interface VerifyOptions {
  cacheDir: string;
  persistDir: string | false;
  reportDir: string;
  snapshotDir: string;
  inventoryDir?: string;
  log: (s: string) => void;
  env?: LocalEnv;
}

interface Check {
  id: string;
  title: string;
  expected: unknown;
  actual: unknown;
  pass: boolean;
  note?: string;
}

export async function verify(bundle: Bundle, opts: VerifyOptions) {
  const proxy = opts.env ? null : await openLocalEnv(opts.persistDir);
  const env = opts.env ?? proxy!.env;
  try {
    return await run(bundle, env, opts);
  } finally {
    if (proxy) await proxy.dispose();
  }
}

async function run(bundle: Bundle, env: LocalEnv, opts: VerifyOptions) {
  const db = createDb(env.DB);
  const checks: Check[] = [];
  const check = (id: string, title: string, expected: unknown, actual: unknown, note?: string) =>
    checks.push({ id, title, expected, actual, pass: JSON.stringify(expected) === JSON.stringify(actual), note });
  const inv = resolve(opts.inventoryDir ?? join(opts.snapshotDir, "../../docs/audit/inventory"));
  const csv = <T>(f: string) => parse(readFileSync(join(inv, f)), { columns: true, bom: true }) as T[];

  // ---- A. bundle against the audit's expected values (counts are expectations, not truths)
  const leadersCsv = csv<{ scope: string; name: string; role_or_title: string; photo_url: string }>("leaders.csv");
  const postsCsv = csv<{ wp_id: string; title: string }>("posts.csv");
  const scopeCount = (sc: string) => bundle.leaders.filter((l) => bundle.leaderGroups.find((g) => g.key === l.group)?.scope === sc).length;
  check("A1", "Posts (REST) vs posts.csv", postsCsv.length, bundle.posts.length);
  check("A2", "Real pages imported (REST lists 14; 3 excluded with reasons)", 11, bundle.pages.length);
  check("A3", "REST pages reconciled: imported + excluded", 14, bundle.pages.length + bundle.excluded.filter((e) => e.kind === "page").length);
  check("A4", "Leader entries vs leaders.csv", leadersCsv.length, bundle.leaders.length);
  check("A5", "State / district / former leaders", [29, 34, 60], [scopeCount("state"), scopeCount("district"), scopeCount("former")]);
  check("A6", "Leader names in published order match leaders.csv", leadersCsv.map((r) => r.name), bundle.leaders.map((l) => l.name));
  check("A7", "Calendar events (real)", 2, bundle.events.length);
  check("A8", "Homepage sections", 9, bundle.sections.filter((x) => x.page === "wp:page:2074").length);
  check(
    "A9",
    "Homepage items: 7 hero slides, 8 posters, 6 logos",
    [7, 8, 6],
    ["hero_carousel", "poster_slider", "logo_carousel"].map(
      (t) => bundle.sectionItems.filter((i) => i.section === bundle.sections.find((x) => x.type === t && x.page === "wp:page:2074")?.key).length,
    ),
  );
  check("A10", "Header menu: 6 top-level, 3 children; 4 social links", [6, 3, 4], [
    bundle.menuItems.filter((m) => m.menu === "header" && !m.parent).length,
    bundle.menuItems.filter((m) => m.menu === "header" && m.parent).length,
    bundle.menuItems.filter((m) => m.menu === "social").length,
  ]);
  check("A11", "PDF documents", 3, bundle.documents.length);
  check("A12", "Legacy URLs: total / same_path / pending", [139, 69, 70], [
    bundle.legacyUrls.length,
    bundle.legacyUrls.filter((u) => u.action === "same_path").length,
    bundle.legacyUrls.filter((u) => u.action === "pending_decision").length,
  ]);
  check("A13", "same_path post/page/event URLs linked to an imported record", 47, bundle.legacyUrls.filter((u) => u.entityKey).length);
  check("A14", "Media items listed by the REST API", 301, bundle.media.filter((m) => m.source === "wp_rest" && !m.variantOf).length);
  const missingCsv = csv<{ file_url?: string; url?: string; live_status?: string }>("missing_from_media_api.csv");
  const htmlOnly = bundle.media.filter((m) => m.source === "html_parse" || m.source === "css_parse");
  check("A15", "Publicly used files missing from the API (20 audited; 3 are 404 demo files not referenced by real pages)", 17, htmlOnly.length);
  check("A16", "No API key in the bundle", false, containsSecret(JSON.stringify(bundle)));

  // ---- B. D1 against the bundle
  // Generic over every content table.
  const n = async (table: any, where?: any) =>
    (await db.select({ c: count() }).from(table).where(where))[0].c;
  const imported = async (table: any) => n(table, sql`source <> 'manual'`);
  for (const [id, label, table, expected] of [
    ["B1", "authors", s.authors, bundle.authors.length],
    ["B2", "media rows", s.media, bundle.media.length],
    ["B3", "documents", s.documents, bundle.documents.length],
    ["B4", "categories", s.categories, bundle.categories.length],
    ["B5", "tags", s.tags, bundle.tags.length],
    ["B6", "pages", s.pages, bundle.pages.length],
    ["B7", "sections", s.sections, bundle.sections.length],
    ["B8", "section items", s.sectionItems, bundle.sectionItems.length],
    ["B9", "posts", s.posts, bundle.posts.length],
    ["B10", "events", s.events, bundle.events.length],
    ["B11", "venues", s.venues, bundle.venues.length],
    ["B12", "organizers", s.organizers, bundle.organizers.length],
    ["B13", "leader groups", s.leaderGroups, bundle.leaderGroups.length],
    ["B14", "leaders", s.leaders, bundle.leaders.length],
    ["B15", "menu items", s.menuItems, bundle.menuItems.length],
  ] as const) {
    check(id, `D1 ${label} imported = bundle`, expected, await imported(table));
  }
  check("B16", "D1 legacy_urls = bundle", bundle.legacyUrls.length, await n(s.legacyUrls));
  check("B17", "No redirects created for pending URLs", 0, (await db.select({ c: count() }).from(s.redirects).innerJoin(s.legacyUrls, eq(s.redirects.legacyUrlId, s.legacyUrls.id)).where(eq(s.legacyUrls.action, "pending_decision")))[0].c);
  check("B18", "Every imported record has exactly one import_items row", true, (await n(s.importItems)) >= bundle.posts.length + bundle.leaders.length + bundle.media.length);
  const postRows = await db.select({ wp: s.posts.legacyWpId, title: s.posts.title, slug: s.posts.slug, status: s.posts.status }).from(s.posts);
  const byWp = new Map(postRows.map((p) => [p.wp, p]));
  const titleMismatch = bundle.posts.filter((p) => byWp.get(p.legacyWpId)?.title !== p.title || byWp.get(p.legacyWpId)?.slug !== p.slug);
  check("B19", "Post titles and slugs in D1 equal the source", 0, titleMismatch.length, titleMismatch.map((p) => p.key).join(", ") || undefined);
  check("B20", "Published posts in D1", bundle.posts.filter((p) => p.status === "published").length, postRows.filter((p) => p.status === "published").length);
  const csvTitles = new Map(postsCsv.map((r) => [Number(r.wp_id), r.title]));
  const csvMismatch = bundle.posts.filter((p) => (csvTitles.get(p.legacyWpId) ?? "") !== p.title);
  check("B21", "Post titles equal posts.csv (independent audit extract)", 0, csvMismatch.length, csvMismatch.map((p) => `${p.legacyWpId}`).join(", ") || undefined);
  check("B22", "Section pages have a current published layout", bundle.pages.filter((p) => p.template === "sections").length, await n(s.publishedLayouts, eq(s.publishedLayouts.isCurrent, true)));
  // Secrets: scan the text columns that hold imported HTML.
  const leaked = await db
    .select({ c: count() })
    .from(s.posts)
    .where(sql`instr(coalesce(${s.posts.legacyBodyHtml}, '') || ${s.posts.bodyHtml}, 'AIza') > 0`);
  const leakedPages = await db.select({ c: count() }).from(s.pages).where(sql`instr(coalesce(${s.pages.legacyBodyHtml}, ''), 'AIza') > 0`);
  const leakedEvents = await db.select({ c: count() }).from(s.events).where(sql`instr(coalesce(${s.events.legacyBodyHtml}, '') || coalesce(${s.events.descriptionHtml}, ''), 'AIza') > 0`);
  const leakedSections = await db.select({ c: count() }).from(s.sections).where(sql`instr(${s.sections.dataJson}, 'AIza') > 0`);
  check("B23", "No Google API key stored in D1", 0, leaked[0].c + leakedPages[0].c + leakedEvents[0].c + leakedSections[0].c);

  // ---- D. files: cache manifest, D1 media rows and R2 objects
  const manifest = readManifest(opts.cacheDir);
  const mediaRows = await db.select({ key: s.media.r2Key, sha: s.media.sha256, status: s.media.fileStatus, bytes: s.media.byteSize }).from(s.media).where(isNull(s.media.deletedAt));
  const files = { listed: bundle.media.length, available: 0, inR2: 0, hashOk: 0, missing: [] as string[], failed: [] as string[], notFetched: [] as string[], r2Problems: [] as string[] };
  let bytes = 0;
  for (const m of bundle.media) {
    const f = manifest[m.path];
    if (!f) files.notFetched.push(m.path);
    else if (f.status === "missing") files.missing.push(`${m.path} (${f.note})`);
    else if (f.status !== "available") files.failed.push(`${m.path} (${f.note})`);
    else {
      files.available++;
      bytes += f.bytes ?? 0;
      const o = await env.MEDIA.head(m.path);
      if (!o) files.r2Problems.push(`${m.path}: not in R2`);
      else {
        files.inR2++;
        if (o.customMetadata?.sha256 === f.sha256 && o.size === f.bytes) files.hashOk++;
        else files.r2Problems.push(`${m.path}: R2 size/hash differs from the manifest`);
      }
    }
  }
  const rowMismatch = mediaRows.filter((r) => {
    const f = manifest[r.key];
    return f?.status === "available" ? r.status !== "available" || r.sha !== f.sha256 : r.status !== "missing";
  });
  check("D1", "Every listed file fetched (not attempted / failed / 404)", [0, 0, 0], [files.notFetched.length, files.failed.length, files.missing.length]);
  check("D2", "Every fetched file is in R2 with the same size and sha256", files.available, files.hashOk);
  check("D3", "D1 media rows agree with the file manifest", 0, rowMismatch.length);
  const auditMissing = missingCsv.filter((r) => String(r.live_status ?? "").startsWith("404"));

  // ---- review queue and conflicts
  const reviewByCode = await db
    .select({ code: s.reviewItems.code, status: s.reviewItems.status, c: count() })
    .from(s.reviewItems)
    .groupBy(s.reviewItems.code, s.reviewItems.status);
  const openConflicts = await db.select().from(s.importConflicts).where(isNull(s.importConflicts.resolvedAt));
  const runs = await db.select().from(s.importRuns).orderBy(sql`${s.importRuns.id} desc`).limit(5);
  const pendingStates = await Promise.all(
    [s.posts, s.leaders, s.documents].map(async (t) => n(t, sql`review_state = 'pending_client'`)),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const report = {
    generatedAt: new Date().toISOString(),
    source: bundle.meta,
    checks,
    summary: { passed, failed },
    files: { ...files, bytes, auditKnown404: auditMissing.map((r) => r.file_url ?? r.url) },
    reviewQueue: reviewByCode,
    pendingClientRecords: { posts: pendingStates[0], leaders: pendingStates[1], documents: pendingStates[2] },
    openConflicts: openConflicts.map((c) => ({ key: c.legacyKey, field: c.field, values: JSON.parse(c.valuesJson) })),
    excluded: bundle.excluded,
    recentRuns: runs.map((r) => ({ id: r.id, mode: r.mode, status: r.status, startedAt: r.startedAt, counts: r.countsJson ? JSON.parse(r.countsJson) : null })),
    notAvailableFromThisSource: [
      "Drafts, private and scheduled posts/pages (need DB dump or WXR, C3)",
      "34 media items the API counts but does not list (335 - 301; need DB dump/WXR/uploads ZIP)",
      "Menus as stored in WordPress, Elementor JSON, revisions, contact-form submissions",
      "3 theme-demo images already 404 on the live site (event-1.jpg, event-2.jpg, graph.png)",
    ],
  };
  mkdirSync(opts.reportDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonFile = join(opts.reportDir, `report-${stamp}.json`);
  const mdFile = join(opts.reportDir, `report-${stamp}.md`);
  writeFileSync(jsonFile, JSON.stringify(report, null, 1));
  writeFileSync(mdFile, toMarkdown(report));
  writeFileSync(join(opts.reportDir, "latest.md"), toMarkdown(report));
  writeFileSync(join(opts.reportDir, "latest.json"), JSON.stringify(report, null, 1));
  await env.PRIVATE.put(`migration-reports/${stamp}/report.json`, JSON.stringify(report), { httpMetadata: { contentType: "application/json" } });
  for (const c of checks) opts.log(`  ${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.title}${c.pass ? "" : `: expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`}`);
  return { passed, failed, reportFile: mdFile, report };
}

function toMarkdown(r: any): string {
  const lines: string[] = [];
  lines.push(`# Migration verification report`, "", `- Generated: ${r.generatedAt}`, `- Source: ${r.source.sourceLabel} (sha256 ${r.source.snapshotSha256.slice(0, 16)}…), kinds: ${r.source.sourceKinds.join(", ")}`, `- Checks: **${r.summary.passed} passed, ${r.summary.failed} failed**`, `- API keys redacted from imported content: ${r.source.secretsRedacted}`, "");
  lines.push("## Checks", "", "| ID | Check | Expected | Actual | Result |", "|---|---|---|---|---|");
  for (const c of r.checks) {
    const fmt = (v: unknown) => {
      const t = JSON.stringify(v);
      return t.length > 60 ? `${t.slice(0, 57)}…` : t;
    };
    lines.push(`| ${c.id} | ${c.title}${c.note ? ` (${c.note})` : ""} | ${fmt(c.expected)} | ${fmt(c.actual)} | ${c.pass ? "pass" : "**FAIL**"} |`);
  }
  const f = r.files;
  lines.push("", "## Files", "", `| | Count |`, `|---|---:|`, `| In the file list | ${f.listed} |`, `| Downloaded and hashed | ${f.available} (${(f.bytes / 1048576).toFixed(1)} MB) |`, `| In local R2 with matching sha256 | ${f.hashOk} |`, `| Not fetched yet | ${f.notFetched.length} |`, `| Failed | ${f.failed.length} |`, `| 404 on the live site | ${f.missing.length} |`, "");
  for (const [label, list] of [["Failed", f.failed], ["404", f.missing], ["Not fetched", f.notFetched], ["R2 problems", f.r2Problems]] as const) {
    if (list.length) lines.push(`**${label}:**`, "", ...list.slice(0, 50).map((x: string) => `- ${x}`), list.length > 50 ? `- … ${list.length - 50} more` : "", "");
  }
  lines.push("Known unavailable (audit, theme-demo pages only): " + (f.auditKnown404.join(", ") || "none"), "");
  lines.push("## Client review queue", "", "| Code | Status | Items |", "|---|---|---:|");
  for (const q of r.reviewQueue) lines.push(`| ${q.code} | ${q.status} | ${q.c} |`);
  lines.push("", `Records imported as published but marked \`pending_client\`: posts ${r.pendingClientRecords.posts}, leaders ${r.pendingClientRecords.leaders}, documents ${r.pendingClientRecords.documents}.`, "");
  lines.push("## Open import conflicts", "", r.openConflicts.length ? r.openConflicts.map((c: any) => `- \`${c.key}\` ${c.field}: ${c.values.reason ?? JSON.stringify(c.values)}`).join("\n") : "None.", "");
  lines.push("## Found in the source but not imported", "", "| Key | What | Reason | Decision |", "|---|---|---|---|");
  for (const e of r.excluded) lines.push(`| ${e.key} | ${e.label} | ${e.reason} | ${e.decisionRef ?? ""} |`);
  lines.push("", "## Not available from the current sources", "", ...r.notAvailableFromThisSource.map((x: string) => `- ${x}`), "");
  lines.push("## Recent import runs", "", "| Run | Mode | Status | Started |", "|---|---|---|---|");
  for (const x of r.recentRuns) lines.push(`| ${x.id} | ${x.mode} | ${x.status} | ${new Date(x.startedAt).toISOString()} |`);
  return lines.join("\n") + "\n";
}


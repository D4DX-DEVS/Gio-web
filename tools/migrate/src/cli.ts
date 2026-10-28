#!/usr/bin/env node
// GIO Kerala WordPress migration CLI (05-MIGRATION-DESIGN.md §3).
//
//   build    snapshot + url_map -> migration/staging/<snapshot>/bundle.json   (offline)
//   files    fetch the bundle's file list into migration/media-cache/        (GET only, rate-limited)
//   load     bundle + media cache -> local D1 and R2 (Miniflare)               (never remote)
//   verify   compare inventories, bundle, D1 and R2; write the migration report
//   all      build, load, verify (does not fetch files)
//
// Nothing here writes to the live WordPress site or to a remote Cloudflare account.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildBundle, writeBundle } from "./build";
import { fetchFiles, verifyCache } from "./files";
import { Bundle } from "./model";

export const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function latestSnapshot(): string {
  const dir = join(REPO_ROOT, "migration");
  const snaps = existsSync(dir) ? readdirSync(dir).filter((d) => d.startsWith("snapshot-")).sort() : [];
  if (!snaps.length) throw new Error("No migration/snapshot-* directory found");
  return join(dir, snaps[snaps.length - 1]);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    snapshot: { type: "string" },
    "url-map": { type: "string" },
    bundle: { type: "string" },
    cache: { type: "string" },
    persist: { type: "string" },
    out: { type: "string" },
    limit: { type: "string" },
    delay: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const snapshotDir = resolve(values.snapshot ?? latestSnapshot());
const label = snapshotDir.split(/[\\/]/).pop()!;
const urlMap = resolve(values["url-map"] ?? join(REPO_ROOT, "docs/audit/inventory/url_map.csv"));
const bundlePath = resolve(values.bundle ?? join(REPO_ROOT, "migration/staging", label, "bundle.json"));
const cacheDir = resolve(values.cache ?? join(REPO_ROOT, "migration/media-cache"));
const persistDir = resolve(values.persist ?? join(REPO_ROOT, "apps/web/.wrangler/state"));
const reportDir = resolve(values.out ?? join(REPO_ROOT, "migration/migration-reports"));
const log = (s: string) => console.log(s);

function loadBundle(): Bundle {
  if (!existsSync(bundlePath)) throw new Error(`No bundle at ${bundlePath}; run \`build\` first`);
  return Bundle.parse(JSON.parse(readFileSync(bundlePath, "utf8")));
}

async function main() {
  const [cmd] = positionals;
  switch (cmd) {
    case "build": {
      const b = buildBundle({ snapshotDir, urlMapCsv: urlMap });
      const file = writeBundle(b, join(bundlePath, ".."));
      log(`build: wrote ${file}`);
      printCounts(b);
      return;
    }
    case "files": {
      const b = loadBundle();
      if (!values["dry-run"] && !values.yes) {
        log("files: this downloads public files from the live site (GET only). Re-run with --yes, or use --dry-run.");
        process.exitCode = 2;
        return;
      }
      const r = await fetchFiles(b, {
        cacheDir,
        delayMs: Number(values.delay ?? 750),
        limit: values.limit ? Number(values.limit) : undefined,
        dryRun: values["dry-run"],
        log,
      });
      const v = verifyCache(cacheDir);
      log(`files: fetched ${r.fetched}, failed ${r.failed}; cache integrity ${v.ok} ok, ${v.bad.length} bad`);
      if (v.bad.length) process.exitCode = 1;
      return;
    }
    case "load": {
      const { loadBundle: load } = await import("./load");
      const r = await load(loadBundle(), { cacheDir, persistDir, dryRun: values["dry-run"], log });
      log(`load: run ${r.runId} ${r.status}`);
      log(JSON.stringify(r.counts, null, 1));
      return;
    }
    case "verify": {
      const { verify } = await import("./verify");
      const r = await verify(loadBundle(), { cacheDir, persistDir, reportDir, snapshotDir, log });
      log(`verify: ${r.failed} failed, ${r.passed} passed; report ${r.reportFile}`);
      if (r.failed) process.exitCode = 1;
      return;
    }
    case "all": {
      const b = buildBundle({ snapshotDir, urlMapCsv: urlMap });
      writeBundle(b, join(bundlePath, ".."));
      printCounts(b);
      const { loadBundle: load } = await import("./load");
      await load(b, { cacheDir, persistDir, dryRun: false, log });
      const { verify } = await import("./verify");
      const r = await verify(b, { cacheDir, persistDir, reportDir, snapshotDir, log });
      log(`verify: ${r.failed} failed, ${r.passed} passed; report ${r.reportFile}`);
      if (r.failed) process.exitCode = 1;
      return;
    }
    default:
      log("usage: gio-migrate <build|files|load|verify|all> [--snapshot DIR] [--bundle FILE] [--cache DIR] [--persist DIR] [--dry-run] [--yes]");
      process.exitCode = cmd ? 1 : 0;
  }
}

function printCounts(b: Bundle) {
  const counts = Object.fromEntries(
    Object.entries(b)
      .filter(([k, v]) => k !== "meta" && Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length]),
  );
  log(JSON.stringify({ ...counts, secretsRedacted: b.meta.secretsRedacted }, null, 1));
  if (b.warnings.length) log(`warnings:\n  ${b.warnings.join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

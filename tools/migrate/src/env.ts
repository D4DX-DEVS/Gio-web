// Local D1 and R2 through Miniflare (wrangler getPlatformProxy). Never remote: remoteBindings is off
// and the config has a placeholder database id.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AnyD1Database } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";

export const MIGRATE_CONFIG = resolve(import.meta.dirname, "../wrangler.jsonc");
export const MIGRATIONS_DIR = resolve(import.meta.dirname, "../../../packages/db/migrations");

/** The subset of the R2 binding the importer uses. */
export interface R2Like {
  head(key: string): Promise<{ customMetadata?: Record<string, string>; size: number } | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; size: number } | null>;
  list(opts?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string; size: number; customMetadata?: Record<string, string> }[];
    truncated: boolean;
    cursor?: string;
  }>;
}

export interface LocalEnv {
  DB: AnyD1Database & {
    prepare(sql: string): { bind(...v: unknown[]): unknown; all(): Promise<{ results: Record<string, unknown>[] }>; run(): Promise<unknown> };
    batch(stmts: unknown[]): Promise<unknown[]>;
  };
  MEDIA: R2Like;
  PRIVATE: R2Like;
}

/**
 * `persistDir` uses the same convention as `wrangler --persist-to`: state lives in `<persistDir>/v3`.
 * Pointing it at apps/web/.wrangler/state lets the web app's local dev server see the data.
 */
export async function openLocalEnv(persistDir: string | false) {
  const proxy = await getPlatformProxy<LocalEnv>({
    configPath: MIGRATE_CONFIG,
    persist: persistDir === false ? false : { path: join(persistDir, "v3") },
    remoteBindings: false,
    envFiles: [],
  });
  return proxy;
}

/** Drizzle-kit migrations in order, split on its statement breakpoints. */
export function migrationStatements(dir = MIGRATIONS_DIR): { file: string; statements: string[] }[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((file) => ({
      file,
      statements: readFileSync(join(dir, file), "utf8")
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean),
    }));
}

/**
 * Apply migrations to a local D1 database, recording them in `d1_migrations` exactly as
 * `wrangler d1 migrations apply --local` does, so either tool can be used afterwards.
 */
export async function applyMigrations(env: LocalEnv): Promise<string[]> {
  const db = env.DB;
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
    )
    .run();
  const done = new Set((await db.prepare("SELECT name FROM d1_migrations").all()).results.map((r: Record<string, unknown>) => String(r.name)));
  const applied: string[] = [];
  for (const m of migrationStatements()) {
    if (done.has(m.file)) continue;
    await db.batch([
      ...m.statements.map((s) => db.prepare(s)),
      (db.prepare("INSERT INTO d1_migrations (name) VALUES (?)") as { bind(...v: unknown[]): unknown }).bind(m.file),
    ]);
    applied.push(m.file);
  }
  return applied;
}

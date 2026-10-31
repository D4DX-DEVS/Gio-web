// Read-only access to a frozen snapshot (migration/snapshot-<date>/). The importer never reads the live site.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { sha256, uploadsKey } from "./lib/util";

export interface CrawlEntry {
  status: number;
  final?: string;
  sitemap?: string;
  file?: string;
  title?: string;
  canonical?: string;
  body_class?: string;
}

export interface HeadResult {
  url: string;
  status: number;
  bytes: number;
  contentType: string;
}

export class Snapshot {
  readonly label: string;
  readonly crawl: Record<string, CrawlEntry>;
  private heads: Map<string, HeadResult> | undefined;

  constructor(readonly dir: string) {
    if (!existsSync(join(dir, "rest")) || !existsSync(join(dir, "crawl.json"))) {
      throw new Error(`Not a snapshot directory (missing rest/ or crawl.json): ${dir}`);
    }
    this.label = basename(dir);
    this.crawl = this.json<Record<string, CrawlEntry>>("crawl.json");
  }

  json<T>(rel: string): T {
    return JSON.parse(readFileSync(join(this.dir, rel), "utf8")) as T;
  }

  rest<T>(name: string): T {
    return this.json<T>(join("rest", name));
  }

  has(rel: string): boolean {
    return existsSync(join(this.dir, rel));
  }

  /** Rendered HTML of an audited URL, or null if the crawl has no file for it. */
  html(url: string): string | null {
    const e = this.crawl[url];
    if (!e?.file) return null;
    return readFileSync(join(this.dir, "html", e.file), "utf8");
  }

  cssFiles(): { name: string; text: string }[] {
    const d = join(this.dir, "css");
    return readdirSync(d)
      .filter((f) => f.endsWith(".css"))
      .sort()
      .map((name) => ({ name, text: readFileSync(join(d, name), "utf8") }));
  }

  /** HEAD results from the audit, keyed by uploads path ('wp-content/uploads/...'). */
  headResults(): Map<string, HeadResult> {
    if (!this.heads) {
      this.heads = new Map();
      const rows = this.json<[string, number, number, string][]>("asset_heads.json");
      for (const [url, status, bytes, contentType] of rows) {
        const key = uploadsKey(url);
        if (key) this.heads.set(key, { url, status, bytes, contentType });
      }
    }
    return this.heads;
  }

  /** sha256 over every file's relative path and bytes, so a bundle records exactly which snapshot it came from. */
  fingerprint(): string {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d).sort()) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(this.dir);
    const parts = files.map((p) => `${relative(this.dir, p).replaceAll("\\", "/")}:${sha256(readFileSync(p))}`);
    return sha256(parts.join("\n"));
  }
}

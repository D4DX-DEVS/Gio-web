// Builds validated lookup tables from the generated legacy URL data.
// Validation runs once per isolate; any inconsistency throws instead of
// producing a redirect nobody approved.
import { isSafeSitePath } from "./paths.ts";
import type { LegacyUrlData, LegacyUrlRow } from "./types.ts";

export interface LegacyLookups {
  /** decoded path → audited disposition */
  dispositions: Map<string, LegacyUrlRow>;
  /** decoded source path → final decoded target (chains collapsed) */
  redirects: Map<string, { to: string; status: 301 | 302 }>;
  gone: Set<string>;
  wpPostIds: Map<string, string>;
  wpPageIds: Map<string, string>;
  postSlugs: Set<string>;
  categorySlugs: Set<string>;
}

export class LegacyDataError extends Error {}

export function buildLookups(data: LegacyUrlData): LegacyLookups {
  const dispositions = new Map(data.rows.map((r) => [r.path, r]));
  const isVerified = (p: string) => dispositions.get(p)?.action === "same_path";
  const isPending = (p: string) => dispositions.get(p)?.action === "pending_decision";

  const gone = new Set<string>();
  for (const p of data.gone) {
    if (isVerified(p)) throw new LegacyDataError(`410 for a verified same_path URL: ${p}`);
    gone.add(p);
  }

  const raw = new Map<string, { to: string; status: 301 | 302 }>();
  for (const r of data.redirects) {
    if (!isSafeSitePath(r.from) || !isSafeSitePath(r.to)) throw new LegacyDataError(`unsafe redirect path: ${r.from} -> ${r.to}`);
    if (r.from === r.to) throw new LegacyDataError(`self-redirect: ${r.from}`);
    if (isVerified(r.from)) throw new LegacyDataError(`redirect from a verified same_path URL: ${r.from}`);
    if (raw.has(r.from)) throw new LegacyDataError(`duplicate redirect source: ${r.from}`);
    raw.set(r.from, { to: r.to, status: r.status });
  }

  // Collapse chains so no redirect points at another redirect; reject cycles and
  // targets that are themselves removed or still waiting for a decision.
  const redirects = new Map<string, { to: string; status: 301 | 302 }>();
  for (const [from, first] of raw) {
    const visited = new Set([from]);
    let target = first.to;
    let status = first.status;
    while (raw.has(target)) {
      if (visited.has(target)) throw new LegacyDataError(`redirect loop through ${target}`);
      visited.add(target);
      const next = raw.get(target)!;
      if (next.status === 302) status = 302; // a temporary hop keeps the whole chain temporary
      target = next.to;
    }
    if (gone.has(target) || isPending(target)) throw new LegacyDataError(`redirect ${from} ends at a removed or pending URL: ${target}`);
    redirects.set(from, { to: target, status });
  }

  for (const [kind, ids] of [["post", data.wpPostIds], ["page", data.wpPageIds]] as const) {
    for (const [id, p] of Object.entries(ids)) {
      if (!/^\d+$/.test(id)) throw new LegacyDataError(`bad WordPress ${kind} id ${id}`);
      if (!isVerified(p)) throw new LegacyDataError(`WordPress ${kind} ${id} maps to an unverified URL: ${p}`);
    }
  }

  return {
    dispositions,
    redirects,
    gone,
    wpPostIds: new Map(Object.entries(data.wpPostIds)),
    wpPageIds: new Map(Object.entries(data.wpPageIds)),
    postSlugs: new Set(data.postSlugs),
    categorySlugs: new Set(data.categorySlugs),
  };
}

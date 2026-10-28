// Site search. The content is small (tens of posts, ~120 leaders), so published rows are read and
// matched in memory with the Malayalam normaliser tested in phase-1 spike B. No FTS index or
// separate search database is needed at this size (05 §4; PHASE_1_SPIKE_RESULTS.md finding 2).
import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@gio/db";
import type { PageLayout } from "@gio/db/layout";
import { getDb } from "./db";
import { getLeaderGroups, listPosts } from "./content";
import { stripHtml } from "./text";

const LEGACY_CHILLU: [RegExp, string][] = [
  [/ണ്‍/g, "ൺ"],
  [/ന്‍/g, "ൻ"],
  [/ര്‍/g, "ർ"],
  [/ല്‍/g, "ൽ"],
  [/ള്‍/g, "ൾ"],
  [/ക്‍/g, "ൿ"],
];

/** Search-only normalisation: NFC, legacy chillu sequences to atomic chillu, drop ZWJ/ZWNJ, lower case. */
export function normalizeForSearch(input: string): string {
  let s = input.normalize("NFC");
  for (const [re, atomic] of LEGACY_CHILLU) s = s.replace(re, atomic);
  return s.replace(/[‌‍]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function layoutText(json: string | null): string {
  if (!json) return "";
  try {
    const layout = JSON.parse(json) as PageLayout;
    return layout.sections
      .flatMap((s) => [s.title ?? "", typeof s.data.html === "string" ? stripHtml(s.data.html, 100000) : "", ...s.items.map((i) => `${i.heading ?? ""} ${i.body ?? ""}`)])
      .join(" ");
  } catch {
    return "";
  }
}

function matches(haystack: string, terms: string[]) {
  const h = normalizeForSearch(haystack);
  return terms.every((t) => h.includes(t));
}

export async function search(query: string) {
  const terms = normalizeForSearch(query).split(" ").filter(Boolean).slice(0, 8);
  if (!terms.length) return null;
  const db = getDb();

  const [{ items: cards }, postRows, pageRows, eventRows, state, district, former] = await Promise.all([
    listPosts({}, 1, 1000),
    db.select({ id: schema.posts.id, title: schema.posts.title, body: schema.posts.bodyHtml, excerpt: schema.posts.excerpt }).from(schema.posts).where(and(eq(schema.posts.status, "published"), isNull(schema.posts.deletedAt))),
    db
      .select({ slug: schema.pages.slug, title: schema.pages.title, layout: schema.publishedLayouts.layoutJson })
      .from(schema.pages)
      .leftJoin(schema.publishedLayouts, and(eq(schema.publishedLayouts.pageId, schema.pages.id), eq(schema.publishedLayouts.isCurrent, true)))
      .where(and(eq(schema.pages.status, "published"), isNull(schema.pages.deletedAt))),
    db
      .select({ slug: schema.events.slug, title: schema.events.title, body: schema.events.descriptionHtml, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(and(inArray(schema.events.status, ["published", "scheduled"]), isNull(schema.events.deletedAt))),
    getLeaderGroups("state"),
    getLeaderGroups("district"),
    getLeaderGroups("former"),
  ]);

  const postText = new Map(postRows.map((p) => [p.id, `${p.title} ${p.excerpt ?? ""} ${stripHtml(p.body, 100000)}`]));
  const posts = cards.filter((c) => matches(postText.get(c.id) ?? c.title, terms));

  const pages = pageRows
    .filter((p) => matches(`${p.title} ${layoutText(p.layout)}`, terms))
    .map((p) => ({ slug: p.slug, title: p.title || "Home" }));

  const events = eventRows.filter((e) => matches(`${e.title} ${stripHtml(e.body, 100000)}`, terms));

  const leaderPages = { state: "/team/", district: "/district-leaders/", former: "/former-leaders/" } as const;
  const leaders = (
    [
      ["state", state],
      ["district", district],
      ["former", former],
    ] as const
  ).flatMap(([scope, groups]) =>
    groups.flatMap((g) =>
      g.leaders
        .filter((l) => matches(`${l.name} ${l.role ?? ""} ${l.district ?? ""} ${l.description ?? ""} ${g.heading ?? ""}`, terms))
        .map((l) => ({ ...l, href: leaderPages[scope], group: g.heading ?? g.termLabel, scope })),
    ),
  );

  return { posts, pages, events, leaders, total: posts.length + pages.length + events.length + leaders.length };
}

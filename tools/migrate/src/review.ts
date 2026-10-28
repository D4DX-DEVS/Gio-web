// Client review queue (04 §3.3, 05 §8.2). Every item records the value exactly as published and
// where it was seen. Nothing here proposes a correction: `suggested_value` stays empty until the
// client supplies one.
import type { BundleParts, ReviewItemRec } from "./model";
import { emptyLeaderSlots } from "./sources/html";

export function buildReviewItems(parts: BundleParts): void {
  const items = new Map<string, ReviewItemRec>();
  const add = (i: ReviewItemRec) => items.set(i.reviewKey, i);
  const leaderLabel = (l: { name: string; roleTitle: string | null; legacySourceUrl: string; description: string | null }) =>
    `${l.name} (${l.roleTitle ?? "no role"}${l.description ? `, ${l.description}` : ""}) on ${l.legacySourceUrl}`;

  // Q1: post without a title.
  for (const p of parts.posts.filter((p) => !p.title)) {
    add({
      reviewKey: `Q1:${p.key}`,
      code: "Q1",
      title: `Post ${p.legacyWpId} has no title on the live site`,
      entityKey: p.key,
      field: "title",
      currentValue: "",
      evidence: `${p.legacyUrl} (posts.csv: EMPTY TITLE). The audit notes it may duplicate the Malayalam post 2719.`,
    });
  }

  // Q2: event reports with publish dates far earlier than when they were entered.
  for (const p of parts.posts) {
    if (p.publishedAtMs && p.modifiedAtMs && new Date(p.publishedAtMs).getUTCFullYear() < 2020 && new Date(p.modifiedAtMs).getUTCFullYear() >= 2025) {
      add({
        reviewKey: `Q2:${p.key}`,
        code: "Q2",
        title: `Publish date ${new Date(p.publishedAtMs).toISOString().slice(0, 10)} is years before the post was last edited: is it the real event date? “${p.title || p.slug}”`,
        entityKey: p.key,
        field: "published_at",
        currentValue: new Date(p.publishedAtMs).toISOString(),
        evidence: `${p.legacyUrl}: published ${new Date(p.publishedAtMs).toISOString().slice(0, 10)}, last modified ${new Date(p.modifiedAtMs).toISOString().slice(0, 10)}`,
      });
    }
  }

  // Q3: the same social link published for different people on the same page.
  for (const field of ["facebookUrl", "instagramUrl"] as const) {
    const byLink = new Map<string, typeof parts.leaders>();
    for (const l of parts.leaders) {
      const v = l[field];
      if (!v) continue;
      const norm = `${l.legacySourceUrl} ${normaliseSocial(v)}`;
      byLink.set(norm, [...(byLink.get(norm) ?? []), l]);
    }
    for (const group of byLink.values()) {
      const names = new Set(group.map((l) => l.name.toLowerCase()));
      if (names.size < 2) continue;
      for (const l of group) {
        add({
          reviewKey: `Q3:${l.key}:${field}`,
          code: "Q3",
          title: `${field === "facebookUrl" ? "Facebook" : "Instagram"} link of ${l.name} is also published for ${group.filter((o) => o !== l).map((o) => o.name).join(", ")}`,
          entityKey: l.key,
          field: field === "facebookUrl" ? "facebook_url" : "instagram_url",
          currentValue: l[field],
          evidence: `${l.legacySourceUrl}, entry ${l.key.split("#")[1]}`,
        });
      }
    }
  }

  // Q4: one photo published under differently spelled names (same person, or a reused photo; Q12).
  const byPhoto = new Map<string, typeof parts.leaders>();
  for (const l of parts.leaders) if (l.photo) byPhoto.set(l.photo, [...(byPhoto.get(l.photo) ?? []), l]);
  for (const [photo, group] of byPhoto) {
    const names = [...new Set(group.map((l) => l.name))];
    if (names.length < 2) continue;
    const normalised = new Set(names.map((n) => n.toLowerCase().replace(/[^a-z]/g, "")));
    add({
      reviewKey: `Q4:${photo}`,
      code: "Q4",
      title: `Photo ${photo.replace("file:wp-content/uploads/", "")} is published with ${names.length} different names: ${names.join(" / ")}`,
      entityKey: group[0].key,
      field: "name",
      currentValue: names.join(" | "),
      evidence: group.map(leaderLabel).join("; ") + (normalised.size === names.length ? " (could be a reused photo of different people: Q12)" : ""),
    });
  }
  // Spellings the audit found across pages and in other content (04 Q4).
  for (const [published, other] of [
    ["RISVANA SHIRIN H", "Rizwana Sherin"],
    ["AYISHA GAFOOR", "AYSHA GAFOOR"],
    ["AFRA SHIHAB ES", "AFRA SHIHAB"],
  ]) {
    const l = parts.leaders.find((x) => x.name === published);
    if (!l || [...items.values()].some((i) => i.code === "Q4" && i.currentValue?.includes(published) && i.currentValue.includes(other))) continue;
    add({
      reviewKey: `Q4:audit:${published}`,
      code: "Q4",
      title: `Name spelling differs between pages: “${published}” / “${other}”`,
      entityKey: l.key,
      field: "name",
      currentValue: published,
      evidence: "04-STATUS-AND-DECISIONS.md §3.3 Q4",
    });
  }

  // Q10: empty team-member widgets.
  for (const s of emptyLeaderSlots) {
    add({
      reviewKey: `Q10:${s.page}#${s.position}`,
      code: "Q10",
      title: `Empty leader slot #${s.position} on ${s.page}: fill the position or remove it`,
      entityKey: null,
      field: null,
      currentValue: s.photo ? `photo only: ${s.photo}` : "(empty)",
      evidence: `${s.page}, team-member widget ${s.position}. Not imported as a person.`,
    });
  }

  // Q11: homepage slides and logos have no links.
  for (const sec of parts.sections.filter((s) => ["hero_carousel", "logo_carousel"].includes(s.type))) {
    const items = parts.sectionItems.filter((i) => i.section === sec.key);
    if (items.length && items.every((i) => !i.linkUrl)) {
      add({
        reviewKey: `Q11:${sec.key}`,
        code: "Q11",
        title: `${sec.type === "hero_carousel" ? "Hero slides" : "Programme logos"} on the homepage have no links (${items.length} items). Should any link somewhere?`,
        entityKey: sec.key,
        field: "link_url",
        currentValue: null,
        evidence: "Homepage, as published",
      });
    }
  }

  // Q12: former-leader photos also used by theme-demo pages.
  for (const file of ["wp-content/uploads/2020/10/shifana.jpg", "wp-content/uploads/2025/07/rizwana-.jpg"]) {
    const users = parts.leaders.filter((l) => l.photo === `file:${file}`);
    if (!users.length) continue;
    add({
      reviewKey: `Q12:${file}`,
      code: "Q12",
      title: `Confirm photo ${file.replace("wp-content/uploads/", "")} for ${[...new Set(users.map((u) => u.name))].join(", ")}`,
      entityKey: users[0].key,
      field: "photo_media_id",
      currentValue: file,
      evidence: `Used by ${users.map(leaderLabel).join("; ")} and by the theme-demo page savelife_team (missing_from_media_api.csv)`,
    });
  }

  // Alt text: none exists. Editors fill it; nothing is generated.
  const imagesUsed = new Set(parts.mediaUsage.map((u) => u.media));
  const noAlt = parts.media.filter((m) => m.kind === "image" && !m.altText && !m.variantOf && imagesUsed.has(m.key));
  if (noAlt.length) {
    add({
      reviewKey: "ALT:images-in-use",
      code: "ALT",
      title: `${noAlt.length} images used on the site have no alt text`,
      entityKey: null,
      field: "alt_text",
      currentValue: null,
      evidence: "No media item on the old site has alt text (04 §2 #2). The admin media library lists them for editors.",
    });
  }

  // C6: library files not used on any imported page, and PDFs not linked anywhere.
  const unused = parts.media.filter((m) => !m.variantOf && !imagesUsed.has(m.key));
  if (unused.length) {
    add({
      reviewKey: "C6:unused-library-files",
      code: "C6",
      title: `${unused.length} library files are not used on any migrated page. Keep them hidden in the library?`,
      entityKey: null,
      field: null,
      currentValue: null,
      evidence: unused.map((m) => m.path.replace("wp-content/uploads/", "")).join(", "),
    });
  }
  for (const d of parts.documents.filter((d) => d.status === "draft")) {
    add({
      reviewKey: `C6:${d.key}`,
      code: "C6",
      title: `PDF “${d.title}” is not linked anywhere on the old site. Publish it on a documents page?`,
      entityKey: d.key,
      field: "status",
      currentValue: d.status,
      evidence: d.media.replace("file:", "/"),
    });
  }

  // D4: URLs waiting on a redirect/410 decision (one item per URL, so each can be decided).
  for (const u of parts.legacyUrls.filter((u) => u.action === "pending_decision")) {
    add({
      reviewKey: `D4:${u.oldPath}`,
      code: u.legacyType === "author-archive" ? "D4a" : "D4",
      title: `Old URL ${u.oldPathDecoded} (${u.legacyType}): 301 to which page, or 410?`,
      entityKey: `legacy_url:${u.oldPath}`,
      field: "action",
      currentValue: "pending_decision",
      evidence: `recommended: ${u.recommendedTarget ?? "none"}${u.note ? `; ${u.note}` : ""}`,
    });
  }

  // C17: the Google Maps key exposed on the old site (never copied).
  add({
    reviewKey: "C17:maps-key",
    code: "C17",
    title: "The old site exposes a Google Maps API key (Naqaba venue page). Its owner should restrict or rotate it.",
    entityKey: null,
    field: null,
    currentValue: "(not stored)",
    evidence: "04-STATUS-AND-DECISIONS.md §3.4 C17. The importer redacts it from every stored value.",
  });

  parts.reviewItems = [...items.values()].sort((a, b) => (a.reviewKey < b.reviewKey ? -1 : 1));
}

/** Drop tracking parameters only; `profile.php?id=` links differ by their query. */
export function normaliseSocial(link: string): string {
  try {
    const u = new URL(link);
    for (const p of [...u.searchParams.keys()]) if (/^(igsh|utm_|mibextid|rdid|share_url|ref)/i.test(p)) u.searchParams.delete(p);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
  } catch {
    return link.toLowerCase();
  }
}

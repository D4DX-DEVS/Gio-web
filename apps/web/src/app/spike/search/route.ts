// Spike B: FTS5 trigram search with Malayalam text on the D1 binding, inside
// the Workers runtime. Uses a throwaway table that is dropped at the end.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { connection } from "next/server";
import { notFound, spikesEnabled } from "@/lib/spikes";
import { normalizeMalayalamForSearch as norm } from "@/lib/spike-ml-normalize";

// Synthetic test strings (generic phrases, not client content).
const DOCS: Array<[number, string]> = [
  [1, "കേരള വിദ്യാർത്ഥി സമ്മേളനം"], // atomic chillu ർ (U+0D7C)
  [2, "കേരള വിദ്യാര്‍ത്ഥി സംഗമം"], // legacy chillu ര്‍ (RA + VIRAMA + ZWJ)
  [3, "പൊതുപരിപാടി ഇന്ന്"], // ൊ precomposed (U+0D4A)
  [4, "പൊതുയോഗം നാളെ"], // ൊ decomposed (U+0D46 U+0D3E), NFD form
  [5, "GIO Kerala annual meet 2026"],
];

const QUERIES: Array<[string, string]> = [
  ["exact word, atomic chillu", "വിദ്യാർത്ഥി"],
  ["exact word, legacy chillu", "വിദ്യാര്‍ത്ഥി"],
  ["partial word (5 code points)", "സമ്മേ"],
  ["partial word (3 code points)", "സമ്"],
  ["partial, 2 code points (below trigram minimum)", "സമ"],
  ["precomposed ൊ", "പൊതു"],
  ["decomposed ൊ (NFD)", "പൊതു"],
  ["latin, case-insensitive", "KERALA ANN"],
];

const cps = (s: string) => [...s].length;
const hex = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join(" ");
const phrase = (q: string) => `"${q.replace(/"/g, '""')}"`;

export async function GET() {
  await connection();
  if (!spikesEnabled()) return notFound();
  const db = getCloudflareContext().env.DB;
  const out: Record<string, unknown> = {};

  // 1. Which tokenizers can be created?
  const tokenizers: Record<string, string> = {};
  for (const tok of ["trigram", "trigram case_sensitive 0", "trigram remove_diacritics 1", "unicode61", "unicode61 remove_diacritics 2", "porter unicode61"]) {
    try {
      await db.exec(`DROP TABLE IF EXISTS spike_tok`);
      await db.prepare(`CREATE VIRTUAL TABLE spike_tok USING fts5(body, tokenize = '${tok}')`).run();
      tokenizers[tok] = "ok";
    } catch (e) {
      tokenizers[tok] = `error: ${(e as Error).message}`;
    }
  }
  await db.exec(`DROP TABLE IF EXISTS spike_tok`);
  out.tokenizers = tokenizers;

  // 2. Raw vs normalised trigram indexes
  await db.batch([
    db.prepare(`DROP TABLE IF EXISTS spike_fts_raw`),
    db.prepare(`DROP TABLE IF EXISTS spike_fts_norm`),
    db.prepare(`CREATE VIRTUAL TABLE spike_fts_raw USING fts5(body, tokenize = 'trigram')`),
    db.prepare(`CREATE VIRTUAL TABLE spike_fts_norm USING fts5(body, tokenize = 'trigram')`),
    ...DOCS.map(([id, body]) => db.prepare(`INSERT INTO spike_fts_raw(rowid, body) VALUES (?, ?)`).bind(id, body)),
    ...DOCS.map(([id, body]) => db.prepare(`INSERT INTO spike_fts_norm(rowid, body) VALUES (?, ?)`).bind(id, norm(body))),
  ]);

  const results = [];
  for (const [label, q] of QUERIES) {
    const r: Record<string, unknown> = { label, query: q, codePoints: cps(q), hex: hex(q) };
    for (const [name, table, query] of [
      ["raw", "spike_fts_raw", q],
      ["normalised", "spike_fts_norm", norm(q)],
    ] as const) {
      try {
        const m = await db.prepare(`SELECT rowid FROM ${table} WHERE ${table} MATCH ? ORDER BY rowid`).bind(phrase(query)).all<{ rowid: number }>();
        r[`${name}_match`] = m.results.map((x) => x.rowid);
      } catch (e) {
        r[`${name}_match`] = `error: ${(e as Error).message}`;
      }
      // LIKE fallback on the same table (trigram tables accelerate LIKE for >= 3 code points)
      const l = await db.prepare(`SELECT rowid FROM ${table} WHERE body LIKE ? ORDER BY rowid`).bind(`%${query}%`).all<{ rowid: number }>();
      r[`${name}_like`] = l.results.map((x) => x.rowid);
    }
    results.push(r);
  }
  out.results = results;

  // 3. Snippet/highlight and bm25 ranking work on trigram tables?
  try {
    const h = await db
      .prepare(`SELECT rowid, highlight(spike_fts_norm, 0, '[', ']') AS hl, bm25(spike_fts_norm) AS rank FROM spike_fts_norm WHERE spike_fts_norm MATCH ? ORDER BY rank`)
      .bind(phrase(norm("വിദ്യാർത്ഥി")))
      .all();
    out.highlight = h.results;
  } catch (e) {
    out.highlight = `error: ${(e as Error).message}`;
  }

  // 4. Unicode facts relevant to normalisation
  out.unicode = {
    nfcEqualsForChillu: "വിദ്യാർത്ഥി".normalize("NFC") === "വിദ്യാര്‍ത്ഥി".normalize("NFC"),
    nfcEqualsForO: "പൊതു".normalize("NFC") === "പൊതു".normalize("NFC"),
    sqliteLowerOnMalayalam: (await db.prepare(`SELECT lower(?) = ? AS same`).bind("കേരള", "കേരള").first<{ same: number }>())?.same,
  };

  await db.batch([db.prepare(`DROP TABLE IF EXISTS spike_fts_raw`), db.prepare(`DROP TABLE IF EXISTS spike_fts_norm`)]);
  return Response.json(out);
}

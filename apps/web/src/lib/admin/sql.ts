// Substring search for admin lists. D1 refuses LIKE patterns longer than 50 bytes ("LIKE or
// GLOB pattern too complex"), which a long search term or a file path easily exceeds, and
// Malayalam takes 3 bytes per letter. instr() has no such limit.
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/** Case-insensitive (ASCII) "column contains text". */
export function contains(col: SQLWrapper, text: string): SQL {
  return sql`instr(lower(${col}), lower(${text})) > 0`;
}

/** Exact, case-sensitive "column contains text" (file paths, JSON keys). */
export function containsExact(col: SQLWrapper, text: string): SQL {
  return sql`instr(${col}, ${text}) > 0`;
}

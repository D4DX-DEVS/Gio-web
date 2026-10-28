// Test helpers: read the audited source data directly, so expectations are derived
// from the audit files rather than hard-coded.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
export const INVENTORY = `${REPO_ROOT}docs/audit/inventory/`;
export const SNAPSHOT = `${REPO_ROOT}migration/snapshot-2026-10-27/`;
export const hasSnapshot = existsSync(SNAPSHOT);

/** Minimal RFC 4180 parser (quoted fields, BOM). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export const readInventory = (name: string) => parseCsv(readFileSync(`${INVENTORY}${name}`, "utf8"));
export const readSnapshotJson = <T>(rel: string): T => JSON.parse(readFileSync(`${SNAPSHOT}${rel}`, "utf8")) as T;

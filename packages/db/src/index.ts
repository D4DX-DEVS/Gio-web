import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };

/** Drizzle client for a D1 binding. Create one per request; bindings are request-scoped on Workers. */
export function createDb(d1: AnyD1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

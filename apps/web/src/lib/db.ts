import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@gio/db";

// D1 bindings are request-scoped on Workers, so a client is created per call.
export function getDb() {
  return createDb(getCloudflareContext().env.DB);
}

export function getEnv() {
  return getCloudflareContext().env;
}

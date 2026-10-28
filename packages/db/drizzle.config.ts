import { defineConfig } from "drizzle-kit";

// Generates SQL migrations only. They are applied by Wrangler
// (`wrangler d1 migrations apply DB --local`, migrations_dir in apps/web/wrangler.jsonc),
// never by drizzle-kit against a remote database.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});

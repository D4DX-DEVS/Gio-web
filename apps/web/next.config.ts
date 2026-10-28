import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Every legacy WordPress URL ends in "/" (docs/audit/05-MIGRATION-DESIGN.md §6.1)
  trailingSlash: true,
  // Workspace packages ship TypeScript source
  transpilePackages: ["@gio/db"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Exposes the wrangler.jsonc bindings (D1, R2, Images) to `next dev`
// through getCloudflareContext().
initOpenNextCloudflareForDev();

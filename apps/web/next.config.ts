import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
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
  async rewrites() {
    // In preview and production the custom Worker entry serves /wp-content/uploads/* from R2
    // before Next.js runs. `next dev` has no Worker entry, so map those URLs to the media route.
    if (process.env.NODE_ENV !== "development") return [];
    return {
      beforeFiles: [{ source: "/wp-content/uploads/:path*", destination: "/media/wp-content/uploads/:path*" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

// Exposes the wrangler.jsonc bindings (D1, R2, Images) to `next dev`
// through getCloudflareContext().
initOpenNextCloudflareForDev();

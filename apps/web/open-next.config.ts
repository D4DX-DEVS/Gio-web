import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config = {
	...defineCloudflareConfig({
		incrementalCache: r2IncrementalCache,
	}),
	// `next build`, then replace Turbopack's package links with real copies so the
	// bundling step works on Windows without Developer Mode (no-op elsewhere).
	// See scripts/materialize-next-links.mjs.
	buildCommand: "pnpm build && node scripts/materialize-next-links.mjs",
};

export default config;

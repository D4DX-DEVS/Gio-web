import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext / Wrangler output and generated binding types
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    // Phase-1 spike scripts (plain Node scripts and a wrangler-bundled entry)
    "spikes/**",
  ]),
]);

export default eslintConfig;

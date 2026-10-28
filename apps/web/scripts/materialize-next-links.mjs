// Replaces directory links (symlinks/junctions) that `next build` writes under .next with
// real copies, so `opennextjs-cloudflare build --skipNextBuild` can copy them on Windows,
// and puts a copy of each aliased package in apps/web/node_modules/<alias>, where OpenNext's
// esbuild step resolves `require("<package>-<hash>")` (the .next/node_modules alias folder
// itself is not in the traced file list that OpenNext copies).
//
// Why: Turbopack emits `.next/node_modules/<package>-<hash>` links for server-external
// packages that the app does not list directly (here: postcss, used by sanitize-html).
// OpenNext recreates every link with fs.symlinkSync, which fails with EPERM on Windows
// unless Developer Mode is on. Copies behave the same at runtime. On Linux/macOS this is a no-op.
import { cpSync, existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") process.exit(0);

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [path.join(web, ".next/node_modules"), path.join(web, ".next/standalone/apps/web/.next/node_modules")];

let replaced = 0;
const aliases = new Map();
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!lstatSync(p).isSymbolicLink()) continue;
    const target = realpathSync(p);
    aliases.set(name, target);
    rmSync(p, { recursive: false, force: true });
    cpSync(target, p, { recursive: true, dereference: true });
    replaced++;
  }
}
for (const [name, target] of aliases) {
  const dest = path.join(web, "node_modules", name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(target, dest, { recursive: true, dereference: true });
}
console.log(`materialize-next-links: replaced ${replaced} link(s); aliases for esbuild: ${[...aliases.keys()].join(", ") || "none"}`);

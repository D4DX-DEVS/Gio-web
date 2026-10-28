#!/usr/bin/env node
// GIO Kerala WordPress migration CLI (placeholder).
// Planned commands (docs/audit/05-MIGRATION-DESIGN.md §3): snapshot, extract,
// normalise, merge, transform, files, load, verify, delta. None is implemented
// yet. The CLI never writes to the live site, and only the explicit `snapshot`
// command will ever read it (rate-limited GET/HEAD).
const [command] = process.argv.slice(2);

console.log(`gio-migrate: ${command ? `"${command}" is not implemented yet` : "no command given"}.`);
console.log("See docs/audit/05-MIGRATION-DESIGN.md for the planned pipeline.");
process.exitCode = command ? 1 : 0;

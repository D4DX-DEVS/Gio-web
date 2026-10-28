// Phase-1 compatibility spikes (docs/architecture/PHASE_1_SPIKE_RESULTS.md).
// Every spike route answers 404 unless ENABLE_SPIKES=1 is set in .dev.vars.
// Remove src/app/spike, src/app/api/spike-auth, src/app/wp-content, src/lib/spike*,
// src/proxy.ts and spikes/ once the decisions in the results document are made.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function spikesEnabled(): boolean {
  // .dev.vars reaches process.env inside workerd (OpenNext copies string bindings),
  // but under `next dev` it is only visible through getCloudflareContext().env.
  if (process.env.ENABLE_SPIKES === "1") return true;
  try {
    return (getCloudflareContext().env as { ENABLE_SPIKES?: string }).ENABLE_SPIKES === "1";
  } catch {
    return false;
  }
}

export function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

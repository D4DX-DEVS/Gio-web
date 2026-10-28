import { getSpikeAuth } from "@/lib/spike-auth";
import { notFound, spikesEnabled } from "@/lib/spikes";

async function handle(request: Request) {
  if (!spikesEnabled()) return notFound();
  return getSpikeAuth(new URL(request.url).origin).handler(request);
}

export { handle as GET, handle as POST };

import type { LayoutItem } from "@gio/db/layout";
import { CHANNEL_URL, bestPoster, channelVideos, videoTitle, youtubeId } from "@/lib/youtube";
import { Container } from "./ui";
import { VideoCards, type VideoCard } from "./VideoCards";

/**
 * Homepage "featured_video" block, as cards: the videos chosen in the admin (Videos screen) in
 * their order, else the one video picked on the old site, then the channel's latest uploads
 * fill the remaining places unless the admin turned that off.
 */
export async function ChannelVideos({
  featuredId,
  title,
  items = [],
  maxCards = 6,
  showLatest = true,
}: {
  featuredId: string;
  title: string;
  items?: LayoutItem[];
  maxCards?: number;
  showLatest?: boolean;
}) {
  const chosen = items.map((i) => ({ id: youtubeId(i.linkUrl), title: i.heading })).filter((v): v is { id: string; title: string | null } => v.id !== null);
  const legacy = youtubeId(featuredId);
  const curated = chosen.length ? chosen : legacy ? [{ id: legacy, title: null }] : [];
  const [latest, titles] = await Promise.all([
    showLatest ? channelVideos(Math.min(15, maxCards + curated.length)) : [],
    Promise.all(curated.map((v) => (v.title ? v.title : videoTitle(v.id)))),
  ]);
  const ids = new Set(curated.map((v) => v.id));
  const picked: VideoCard[] = [
    ...curated.map((v, k) => ({ id: v.id, title: titles[k] ?? "GIO Kerala video" })),
    ...latest.filter((v) => !ids.has(v.id)),
  ].slice(0, maxCards);
  if (!picked.length) return null;
  const posters = await Promise.all(picked.map((v) => bestPoster(v.id)));
  const videos = picked.map((v, k) => ({ ...v, poster: posters[k] }));

  return (
    <section className="relative overflow-hidden bg-brand-900 py-10 text-white sm:py-12 lg:py-14">
      <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-accent-600/15 blur-3xl" />
      <Container className="relative">
        <div className="reveal mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-500 sm:text-[0.8125rem]">GIO Kerala on YouTube</p>
            <h2 className="font-display text-[1.375rem] font-bold leading-tight sm:text-[1.625rem] lg:text-[1.875rem]">{title}</h2>
          </div>
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-fx inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-[0.9375rem] font-semibold ring-1 ring-white/20 hover:bg-accent-600 hover:ring-accent-600"
          >
            Visit our channel
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
        <VideoCards videos={videos} />
      </Container>
    </section>
  );
}

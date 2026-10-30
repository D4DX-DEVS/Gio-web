/** GIO Kerala's YouTube channel (linked from every page of the old site). */
export const CHANNEL_URL = "https://www.youtube.com/@giokerala5691";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCZoGnWiICApK-chkcLymDAg";

export interface ChannelVideo {
  id: string;
  title: string;
  published: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );

/**
 * Latest regular uploads from the channel's public RSS feed (the 15 newest entries, Shorts
 * left out because cards are 16:9). Cached for an hour; any failure returns [] so the page
 * still renders with the featured video alone.
 */
export async function channelVideos(limit = 6): Promise<ChannelVideo[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: ChannelVideo[] = [];
    for (const [, e] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const id = e.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/)?.[1];
      const link = e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
      if (!id || link.includes("/shorts/")) continue;
      out.push({
        id,
        title: unescape(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim(),
        published: e.match(/<published>([^<]+)<\/published>/)?.[1] ?? "",
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Poster sizes YouTube publishes for a video. hqdefault (480x360) exists for every upload;
 * sddefault (640x480) and maxresdefault (1280x720) only when the source was big enough, and
 * the missing ones answer 404.
 */
export type PosterSize = "maxresdefault" | "sddefault" | "hqdefault";

/** Largest poster YouTube has for a video, checked with HEAD and cached for a week. */
export async function bestPoster(id: string): Promise<PosterSize> {
  const exists = async (size: PosterSize) => {
    try {
      const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, {
        method: "HEAD",
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  const [maxres, sd] = await Promise.all([exists("maxresdefault"), exists("sddefault")]);
  return maxres ? "maxresdefault" : sd ? "sddefault" : "hqdefault";
}

/**
 * `src`/`srcSet` for a poster, so the browser picks the smallest frame that is still sharp for
 * the card's size and the screen's pixel density. The 4:3 sizes (hq, sd) carry black bars
 * that `object-cover` crops away in a 16:9 box.
 */
export function posterImage(id: string, best: PosterSize = "hqdefault") {
  const url = (size: string) => `https://i.ytimg.com/vi/${id}/${size}.jpg`;
  const set = [`${url("mqdefault")} 320w`, `${url("hqdefault")} 480w`];
  if (best !== "hqdefault") set.push(`${url("sddefault")} 640w`);
  if (best === "maxresdefault") set.push(`${url("maxresdefault")} 1280w`);
  return { src: url(best), srcSet: set.join(", ") };
}

/**
 * YouTube's official embed player (privacy-enhanced domain). Only loaded after the visitor
 * clicks play, so autoplay here starts the video they asked for. Quality is left to YouTube's
 * adaptive streaming, which follows the player's size and the connection; there is no
 * supported parameter to force a resolution.
 */
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;

/** iframe attributes shared by every player. YouTube needs the referrer to identify the embedding site. */
export const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
export const EMBED_REFERRER = "strict-origin-when-cross-origin";

/**
 * Video id from anything an editor pastes: a bare id, a watch, youtu.be, embed, shorts or live
 * link (with or without www., m. or the nocookie domain). Null when it is not a YouTube video.
 */
export function youtubeId(input: string | null | undefined): string | null {
  const v = input?.trim() ?? "";
  if (/^[\w-]{11}$/.test(v)) return v;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    id = u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Canonical watch link stored for a video. */
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** A video's real title from YouTube's oEmbed endpoint, or null if it can't be fetched. */
export async function videoTitle(id: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

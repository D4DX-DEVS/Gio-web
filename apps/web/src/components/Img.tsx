/* eslint-disable @next/next/no-img-element -- media is served from R2 at its original size; no transformation service is used */
import type { PublicMedia } from "@/lib/content";

interface Props {
  media: PublicMedia | null | undefined;
  alt?: string;
  className?: string;
  eager?: boolean;
  /** Shown when the file is missing, so gaps stay visible instead of being silently replaced. */
  fallbackLabel?: string;
}

export function Img({ media, alt, className, eager, fallbackLabel }: Props) {
  if (!media) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-400 ${className ?? ""}`} role="img" aria-label={fallbackLabel ?? "Image not available"}>
        <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="m21 16-5-5-9 9" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={media.url}
      alt={alt ?? media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      className={className}
    />
  );
}

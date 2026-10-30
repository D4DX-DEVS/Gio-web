"use client";
import { useState } from "react";
import { EMBED_ALLOW, EMBED_REFERRER, youtubeId } from "@/lib/youtube";

/** YouTube link input with a live thumbnail and an inline player to check the video before saving. */
export function VideoField({ defaultValue = "", required = true }: { defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(value);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label">YouTube link</span>
        <input
          name="linkUrl"
          className="field"
          required={required}
          placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setPlaying(false);
            e.currentTarget.setCustomValidity(e.target.value && !youtubeId(e.target.value) ? "This is not a YouTube video link." : "");
          }}
        />
      </label>
      {value && !id ? <p className="text-xs font-medium text-accent-700">This is not a YouTube video link.</p> : null}
      {id ? (
        <div className="relative aspect-video overflow-hidden rounded-lg bg-brand-900 ring-1 ring-line">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
              title="Video preview"
              allow={EMBED_ALLOW}
              referrerPolicy={EMBED_REFERRER}
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label="Play preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 m-auto flex h-12 w-16 items-center justify-center rounded-xl bg-accent-600 text-white shadow-lg transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

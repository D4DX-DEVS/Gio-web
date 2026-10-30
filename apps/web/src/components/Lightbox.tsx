"use client";
/* eslint-disable @next/next/no-img-element -- original files from R2, no transformation service */

import { useEffect, useRef, useState } from "react";
import { langOf } from "@/lib/text";
import { CloseButton, Modal } from "./Modal";

export interface LightboxItem {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  caption?: string;
  meta?: string;
  /** Optional link shown under the image (for example the story the photo belongs to). */
  href?: string;
  hrefLabel?: string;
}

interface Props {
  items: LightboxItem[];
  index: number | null;
  open: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
}

const MAX_ZOOM = 4;
/** Scale a click or tap on the picture zooms to. */
const CLICK_ZOOM = 2.5;
/** Factor one press of the zoom buttons or keys changes the scale by. */
const STEP = 1.6;

/** Zoom state of the picture shown; `key` ties it to one picture, so another picture starts unzoomed. */
interface View {
  key: string;
  s: number;
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Clamps the scale, and the offset so the zoomed picture can be moved up to its edges but not past them. */
function fit(key: string, s: number, x: number, y: number, stage: HTMLElement | null, img: HTMLElement | null): View {
  s = clamp(s, 1, MAX_ZOOM);
  if (!stage || !img || s === 1) return { key, s: 1, x: 0, y: 0 };
  const mx = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
  const my = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
  return { key, s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
}

/** Zooms to scale `s`, keeping the point under the pointer (or the centre of the stage) where it is. */
function zoomAround(v: View, s: number, at: { x: number; y: number } | null, stage: HTMLElement | null, img: HTMLElement | null): View {
  s = clamp(s, 1, MAX_ZOOM);
  const r = stage?.getBoundingClientRect();
  const qx = at && r ? at.x - r.left - r.width / 2 : 0;
  const qy = at && r ? at.y - r.top - r.height / 2 : 0;
  const k = s / v.s;
  return fit(v.key, s, qx - (qx - v.x) * k, qy - (qy - v.y) * k, stage, img);
}

/**
 * Full-screen image viewer: arrow keys and swipe move between images, Escape closes. Clicking
 * the picture zooms in at that point (and out again); while zoomed, drag to move around. The
 * wheel, a pinch, the +/- buttons and the + - 0 keys zoom too.
 */
export function Lightbox({ items, index, open, onClose, onIndex }: Props) {
  const touchX = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Where the current drag or pinch started, and the zoom at that moment.
  const gesture = useRef<{ x: number; y: number; dist: number; v: View } | null>(null);
  // Set once a press moves, so the click that ends a drag neither zooms nor closes the viewer.
  const moved = useRef(false);
  const [gesturing, setGesturing] = useState(false);

  const item = index === null ? null : items[index];
  const many = items.length > 1;
  const viewKey = open && index !== null ? String(index) : "";
  const [zoom, setZoom] = useState<View>({ key: "", s: 1, x: 0, y: 0 });
  const view = zoom.key === viewKey ? zoom : { key: viewKey, s: 1, x: 0, y: 0 };
  const zoomed = view.s > 1;

  const go = (d: number) => {
    if (index === null || !many) return;
    onIndex((index + d + items.length) % items.length);
  };
  const zoomTo = (s: (v: View) => number, at: { x: number; y: number } | null = null) =>
    setZoom((prev) => {
      const v = prev.key === viewKey ? prev : { key: viewKey, s: 1, x: 0, y: 0 };
      return zoomAround(v, s(v), at, stageRef.current, imgRef.current);
    });

  // React listens to wheel events passively, so the page would zoom or scroll as well; listen here instead.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !viewKey) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      setZoom((prev) => {
        const v = prev.key === viewKey ? prev : { key: viewKey, s: 1, x: 0, y: 0 };
        return zoomAround(v, v.s * Math.exp(-dy * 0.002), { x: e.clientX, y: e.clientY }, stage, imgRef.current);
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [viewKey]);

  /** Starts the drag or pinch again from the pointers now down, so adding or lifting a finger does not jump. */
  const restartGesture = () => {
    const pts = [...pointers.current.values()];
    if (!pts.length) {
      gesture.current = null;
      setGesturing(false);
      return;
    }
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { x, y, dist, v: view };
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    restartGesture();
  };

  return (
    <Modal open={open && !!item} onClose={onClose} label="Image viewer" variant="fullscreen" className="text-white">
      {item && (
        <div
          data-no-zoom
          className="flex h-full w-full flex-col"
          // This viewer covers the whole dialog, so Modal's own backdrop click never fires:
          // any click on the dark area around the picture (not the picture or a control) closes it.
          onClick={(e) => {
            if (moved.current) return;
            if (!(e.target as HTMLElement).closest("img, button, a, p")) onClose();
          }}
          onPointerDownCapture={() => {
            if (!pointers.current.size) moved.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
            else if (e.key === "+" || e.key === "=") zoomTo((v) => v.s * STEP);
            else if (e.key === "-") zoomTo((v) => v.s / STEP);
            else if (e.key === "0") zoomTo(() => 1);
          }}
          onTouchStart={(e) => {
            // A zoomed picture is dragged, and two fingers pinch: neither is a swipe to the next image.
            touchX.current = zoomed || e.touches.length > 1 ? null : e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-5">
            <p className="text-sm text-white/80" aria-live="polite">
              {many ? `${index! + 1} / ${items.length}` : ""}
            </p>
            <div className="flex items-center gap-1">
              <ZoomButton dir="out" disabled={!zoomed} onClick={() => zoomTo((v) => v.s / STEP)} />
              <ZoomButton dir="in" disabled={view.s >= MAX_ZOOM} onClick={() => zoomTo((v) => v.s * STEP)} />
              <CloseButton onClick={onClose} label="Close image viewer" className="text-white hover:bg-white/15" />
            </div>
          </div>
          <div
            ref={stageRef}
            className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              restartGesture();
            }}
            onPointerMove={(e) => {
              const g = gesture.current;
              if (!g || !pointers.current.has(e.pointerId)) return;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const pts = [...pointers.current.values()];
              const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
              const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
              if (Math.hypot(x - g.x, y - g.y) > 6 || pts.length > 1) moved.current = true;
              const pinch = pts.length > 1 && g.dist > 0;
              // An unzoomed picture only reacts to a pinch; a one-finger move there is a swipe.
              if (!pinch && g.v.s === 1) return;
              const s = clamp(pinch ? (g.v.s * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / g.dist : g.v.s, 1, MAX_ZOOM);
              const r = e.currentTarget.getBoundingClientRect();
              const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
              // Keep the point that was under the fingers (or pointer) at the start under them now.
              const k = s / g.v.s;
              setGesturing(true);
              setZoom(fit(viewKey, s, x - cx - (g.x - cx - g.v.x) * k, y - cy - (g.y - cy - g.v.y) * k, stageRef.current, imgRef.current));
            }}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
          >
            <div
              className={`absolute inset-0 flex items-center justify-center px-2 sm:px-16 ${gesturing ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none"}`}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
            >
              <img
                ref={imgRef}
                key={item.src}
                src={item.src}
                alt={item.alt}
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                draggable={false}
                onClick={(e) => {
                  if (moved.current) return;
                  zoomTo((v) => (v.s > 1 ? 1 : CLICK_ZOOM), { x: e.clientX, y: e.clientY });
                }}
                className={`max-h-full max-w-full animate-[photo-pop-3d_0.55s_var(--ease-soft)_both] rounded-lg object-contain shadow-2xl ${zoomed ? (gesturing ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"}`}
              />
            </div>
            {many && (
              <>
                <NavButton dir="prev" onClick={() => go(-1)} />
                <NavButton dir="next" onClick={() => go(1)} />
              </>
            )}
          </div>
          {(item.caption || item.meta || item.href) && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-3 text-center">
              {item.caption && (
                <p lang={langOf(item.caption)} className="font-semibold leading-snug">
                  {item.caption}
                </p>
              )}
              {item.meta && <p className="mt-1 text-sm text-white/70">{item.meta}</p>}
              {item.href && (
                <a href={item.href} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-50">
                  {item.hrefLabel ?? "Open"} <span aria-hidden>→</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ZoomButton({ dir, disabled, onClick }: { dir: "in" | "out"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "in" ? "Zoom in" : "Zoom out"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/15 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d={dir === "in" ? "m20 20-3.5-3.5M8 11h6M11 8v6" : "m20 20-3.5-3.5M8 11h6"} />
      </svg>
    </button>
  );
}

function NavButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-white/30 active:scale-95 sm:h-12 sm:w-12 sm:bg-white/15 ${dir === "prev" ? "left-1 sm:left-3" : "right-1 sm:right-3"}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d={dir === "prev" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}

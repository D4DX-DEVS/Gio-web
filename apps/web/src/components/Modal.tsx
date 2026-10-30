"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Accessible name when there is no visible heading to point at. */
  label?: string;
  labelledBy?: string;
  /** "drawer" slides in from the right edge (mobile menu); "dialog" is centred. */
  variant?: "dialog" | "drawer" | "fullscreen";
  className?: string;
  children: React.ReactNode;
}

const PLACEMENT = {
  dialog: "m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white shadow-pop",
  drawer: "modal-drawer ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(24rem,100vw)] overflow-y-auto bg-white shadow-pop",
  fullscreen: "m-0 h-dvh max-h-dvh w-screen max-w-none bg-black/60",
} as const;

/**
 * Accessible modal built on the native <dialog> element: showModal() moves focus inside, makes
 * the rest of the page inert, closes on Escape and returns focus to the opener on close.
 * Background scrolling is blocked in globals.css (html:has(dialog[open])). Children stay mounted
 * while closed so the closing transition still shows them; callers render nothing until first use.
 */
export function Modal({ open, onClose, label, labelledBy, variant = "dialog", className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`modal ${PLACEMENT[variant]} ${className}`}
    >
      {children}
    </dialog>
  );
}

export function CloseButton({ onClick, label = "Close", className = "" }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-black/10 active:scale-95 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

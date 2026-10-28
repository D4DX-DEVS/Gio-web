"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center">
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="font-display text-6xl font-bold text-brand-100">Oops</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-brand-900">Something went wrong</h1>
        <p className="mt-4 text-muted">The page could not be loaded. Please try again in a moment.</p>
        {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}

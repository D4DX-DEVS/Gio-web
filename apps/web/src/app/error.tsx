"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="font-display text-6xl font-bold text-brand-100 sm:text-7xl">Oops</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-brand-900 sm:text-4xl">Something went wrong</h1>
        <p className="mt-4 text-lg text-muted">The page could not be loaded. Please try again in a moment.</p>
        {error.digest && <p className="mt-2 text-sm text-muted">Reference: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary !px-6 !py-3 !text-base">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost !px-6 !py-3 !text-base">
            Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}

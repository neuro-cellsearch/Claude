"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Branded fallback for unexpected client/server render errors (details are logged server-side). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="surface-raised max-w-md p-8 text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-xl font-semibold text-fg">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-[14px] text-muted">The problem has been logged. Please try again — if it keeps happening, contact support{error.digest ? ` quoting reference ${error.digest}` : ""}.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="h-10 rounded-lg bg-signal-500 px-4 text-sm font-medium text-white hover:bg-signal-400">Try again</button>
          <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm text-fg">Home</Link>
        </div>
      </div>
    </main>
  );
}

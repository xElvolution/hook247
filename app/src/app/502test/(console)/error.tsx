"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

/**
 * Catches transient failures on any console page — Overview fires ~23 parallel
 * queries, and the Neon pooler occasionally drops an idle connection (P1001).
 * Without this, one blip renders a raw HTTP 500. With it, the admin gets the
 * shell (nav still works) plus a one-click retry, which is all a momentary
 * connection drop actually needs.
 *
 * This wraps page.js and nested pages, but not the layout in this same segment —
 * the layout's own count query is hardened separately.
 */
export default function ConsoleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[502test] console page failed to render:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>

      <h2 className="font-display text-xl font-bold text-ink">
        Couldn&apos;t load this page
      </h2>
      <p className="mt-2 text-sm text-muted">
        The database didn&apos;t answer in time. This is usually a momentary
        connection drop. Try again.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted/70">
          ref {error.digest}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

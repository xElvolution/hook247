"use client";

import Link from "next/link";

export default function ProfileError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-2xl font-bold">Profile could not load</p>
      <p className="mt-2 text-sm text-muted">Try again, or go back to the directory.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn-primary text-sm">
          Back to profiles
        </Link>
      </div>
    </div>
  );
}

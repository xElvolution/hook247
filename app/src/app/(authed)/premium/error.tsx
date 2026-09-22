"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PremiumError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;
    fetch("/api/premium/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    }).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Billing is catching up</h1>
      <p className="mt-3 text-sm text-muted">
        If you just paid, the payment is still being confirmed. Refresh this page or open your profile in a moment.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/profile" className="btn-primary text-sm">
          Open profile
        </Link>
      </div>
    </div>
  );
}

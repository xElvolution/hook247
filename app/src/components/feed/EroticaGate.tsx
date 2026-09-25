"use client";

import Link from "next/link";
import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

/** Shown in place of the Erotica board until the member signs in and confirms they are 18+. */
export default function EroticaGate({
  signedIn,
  onConfirmed,
}: {
  signedIn: boolean;
  onConfirmed: () => void;
}) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!agree || busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/me/adult", { method: "POST" }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (!response?.ok) {
      setError(data.error ?? "We could not save that. Try again.");
      return;
    }
    onConfirmed();
  }

  if (!signedIn) {
    return (
      <div className="erotica-gate">
        <LockKeyhole className="h-8 w-8 text-[#df3a6a]" />
        <h2>Erotica is for members only</h2>
        <p>Sign in to see explicit posts from verified members. You must be 18 or older.</p>
        <div className="erotica-gate-actions">
          <Link href={`/login?next=${encodeURIComponent("/feed?tab=erotica")}`} className="btn-primary text-sm">Log in</Link>
          <Link href={`/signup?next=${encodeURIComponent("/feed?tab=erotica")}`} className="btn-ghost text-sm">Create account</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="erotica-gate">
      <ShieldCheck className="h-8 w-8 text-[#df3a6a]" />
      <h2>Adults only</h2>
      <p>
        Erotica contains explicit sexual text, photos and videos. Media stays blurred until you tap it.
        Anything that looks underage or shared without consent can be reported and is pulled while we review it.
      </p>
      <label className="erotica-gate-check">
        <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
        <span>I am 18 or older and I choose to view explicit adult content.</span>
      </label>
      {error ? <p className="poll-error" role="alert">{error}</p> : null}
      <div className="erotica-gate-actions">
        <button type="button" className="btn-primary text-sm" disabled={!agree || busy} onClick={confirm}>
          {busy ? "Saving..." : "Enter Erotica"}
        </button>
      </div>
    </div>
  );
}

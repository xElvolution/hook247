"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, ImageUp, Lock, Timer, X } from "lucide-react";

/** Small "Get verified" option that explains the flow in a sheet before starting it. */
export default function GetVerifiedButton({ className = "", children, ariaLabel }: { className?: string; children?: ReactNode; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setOpen(true)}>
        {children ?? <><BadgeCheck className="h-4 w-4" /> Get verified</>}
      </button>
      {open ? (
        <div className="verify-sheet-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="verify-sheet" role="dialog" aria-modal="true" aria-labelledby="verify-sheet-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="verify-sheet-close" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </button>
            <h2 id="verify-sheet-title" className="font-display text-xl font-bold">Verify your account</h2>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3"><span className="verify-sheet-step"><ImageUp className="h-4 w-4" /></span>Upload a clear photo of yourself</li>
              <li className="flex items-center gap-3"><span className="verify-sheet-step"><Camera className="h-4 w-4" /></span>Do a quick live check: look, blink, turn</li>
              <li className="flex items-center gap-3"><span className="verify-sheet-step"><Timer className="h-4 w-4" /></span>Takes under a minute</li>
            </ol>
            <div className="privacy-note mt-5">
              <Lock className="h-5 w-5 shrink-0" aria-hidden />
              <p><strong>Everything is private.</strong> Your photo and video are never posted or shared, and your information is never leaked.</p>
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={() => router.push("/verify")}>Start verification</button>
            <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setOpen(false)}>Not now</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

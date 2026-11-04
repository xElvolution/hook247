"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function PromoCopyLink({ link, code }: { link: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the link is selectable */
    }
  }
  return (
    <div className="mt-4">
      <p className="promo-label">Your special referral link</p>
      <div className="promo-link">
        <span className="truncate">{link}</span>
      </div>
      <button type="button" className="promo-cta !mt-3" onClick={copy}>
        {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
      </button>
      {code ? <p className="promo-code">Code: <strong>{code}</strong></p> : null}
    </div>
  );
}

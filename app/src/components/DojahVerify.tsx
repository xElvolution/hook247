"use client";

import { useCallback, useState } from "react";
import Script from "next/script";
import { motion } from "framer-motion";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";

/**
 * The "Get verified" card. Launches the Dojah widget (NIN + selfie liveness,
 * configured in the Dojah dashboard and referenced by widgetId). On success we
 * show a pending state; the actual badge is granted by the signed Dojah webhook
 * at /api/webhooks/dojah — never from the browser callback.
 */
export default function DojahVerify({
  userId,
  appId,
  publicKey,
  widgetId,
  verified,
}: {
  userId: string;
  appId: string;
  publicKey: string;
  widgetId: string;
  verified: boolean;
}) {
  const configured = Boolean(appId && publicKey);
  // The script may already be on the page from an earlier mount; seed from that
  // rather than an effect (which would trigger a cascading render).
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.Connect)
  );
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const launch = useCallback(() => {
    setError("");
    if (!window.Connect) {
      setError("Verification is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const connect = new window.Connect({
        app_id: appId,
        p_key: publicKey,
        type: widgetId ? "custom" : "verification",
        ...(widgetId ? { config: { widget_id: widgetId } } : {}),
        metadata: { user_id: userId },
        onSuccess: () => {
          // The webhook does the real grant; reflect "in review" here.
          setBusy(false);
          setSubmitted(true);
        },
        onError: () => {
          setBusy(false);
          setError("Verification could not be completed. Please try again.");
        },
        onClose: () => setBusy(false),
      });
      connect.setup();
      connect.open();
    } catch {
      setBusy(false);
      setError("Could not open verification. Please try again.");
    }
  }, [appId, publicKey, widgetId, userId]);

  return (
    <div className="glass rounded-3xl p-6">
      {configured && (
        <Script
          src="https://widget.dojah.io/widget.js"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onLoad={() => setScriptReady(true)}
        />
      )}

      <h3 className="font-display flex items-center gap-2 font-bold">
        <BadgeCheck className="h-4 w-4 text-sky-400" /> Get verified
      </h3>

      {verified ? (
        <p className="mt-1.5 text-sm text-muted">
          Your profile is verified. The badge shows on every card you appear in.
        </p>
      ) : submitted ? (
        <p className="mt-1.5 flex items-start gap-2 text-sm text-emerald-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Check submitted. Your badge appears once your ID and selfie are
          confirmed, usually within a few minutes.
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">
          Free. Confirm your NIN and take a quick selfie to prove you&apos;re
          real and get the verified badge.
        </p>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400"
        >
          {error}
        </motion.p>
      )}

      <button
        type="button"
        onClick={launch}
        disabled={verified || submitted || busy || !configured || !scriptReady}
        className="btn-ghost mt-4 w-full !py-2.5 text-sm"
      >
        {verified
          ? "Already verified"
          : submitted
          ? "In review"
          : busy
          ? "Opening…"
          : !configured
          ? "Verification unavailable"
          : !scriptReady
          ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </>
          )
          : "Verify my profile"}
      </button>
    </div>
  );
}

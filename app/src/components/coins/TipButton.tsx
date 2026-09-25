"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Coins, HandCoins, Loader2, X } from "lucide-react";
import { coinCount, newNonce } from "./format";

const AMOUNTS = [10, 50, 100, 500, 1000];

/** Send coins to an escort. Opens a bottom sheet with preset amounts. */
export default function TipButton({
  toUserId,
  toName,
  source,
  postId,
  guest = false,
  className = "",
  label = "Tip",
}: {
  toUserId: string;
  toName: string;
  source: "profile" | "post";
  postId?: string;
  guest?: boolean;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [nonce, setNonce] = useState("");

  useEffect(() => {
    if (!open) return;
    setNonce(newNonce());
    fetch("/api/coins/balance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setBalance(b?.balance ?? 0))
      .catch(() => setBalance(null));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function start() {
    if (guest) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setSent("");
    setError("");
    setOpen(true);
  }

  const coins = custom ? Math.floor(Number(custom) || 0) : amount;
  const short = balance !== null && coins > balance;

  async function send() {
    if (busy || coins < 1 || short) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/coins/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId, coins, nonce, source, postId }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (!response?.ok) {
      setError(body.error ?? "The tip did not go through. Try again.");
      if (response?.status === 402) setBalance((b) => b);
      return;
    }
    setBalance(body.balance);
    setSent(`You sent ${coinCount(body.coins)} coins to ${toName}.`);
    setNonce(newNonce());
  }

  return (
    <>
      <button type="button" className={className || "tip-button"} onClick={start}>
        <HandCoins className="h-[18px] w-[18px]" /> {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="tip-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="tip-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Tip ${toName}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="tip-sheet-head">
                <strong>Tip {toName}</strong>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
              <p className="tip-sheet-balance">
                <Coins className="h-4 w-4" /> Balance: {balance === null ? "..." : coinCount(balance)}
                <Link href="/coins">Buy coins</Link>
              </p>
              {sent ? (
                <div className="tip-sheet-done">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <p>{sent}</p>
                  <button type="button" className="btn-ghost text-sm" onClick={() => setSent("")}>Send another</button>
                </div>
              ) : (
                <>
                  <div className="tip-amounts">
                    {AMOUNTS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        data-active={!custom && amount === value}
                        onClick={() => {
                          setAmount(value);
                          setCustom("");
                        }}
                      >
                        <Coins className="h-4 w-4" /> {coinCount(value)}
                      </button>
                    ))}
                    <input
                      inputMode="numeric"
                      placeholder="Other"
                      value={custom}
                      aria-label="Custom amount"
                      onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  {short ? (
                    <p className="coin-flash mt-3" data-tone="bad">
                      Not enough coins. <Link href="/coins" className="underline">Top up</Link>
                    </p>
                  ) : null}
                  {error ? <p className="coin-flash mt-3" data-tone="bad">{error}</p> : null}
                  <button type="button" className="btn-primary mt-4 w-full text-sm" disabled={busy || coins < 1 || short} onClick={send}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send ${coinCount(coins)} coins`}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Copy, Gift, UserPlus, Users, X } from "lucide-react";

type Notice =
  | { show: false }
  | {
      show: true;
      state: "guest" | "verify" | "refer";
      title: string;
      amountLabel: string;
      required: number;
      qualified: number;
      rewardStatus: string | null;
      code: string;
      link: string;
      pillDismissed: boolean;
      href: string;
    };

const PILL_KEY = "flirta-reward-pill";
const POP_KEY = "flirta-reward-pop-at";
const NO_REMIND_KEY = "flirta-reward-noremind";
const REMIND_MS = 20 * 60 * 60 * 1000;

/** Home-only reward pill that opens the claim pop-up. Reminds at most once a day until verified. */
export default function WelcomeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pill, setPill] = useState(false);
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/welcome/notice", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { show: false }))
      .then((data: Notice) => {
        if (!alive) return;
        if (!data?.show) return setNotice({ show: false });
        setNotice(data);
        setPill(!data.pillDismissed && localStorage.getItem(PILL_KEY) !== "dismissed");
        const last = Number(localStorage.getItem(POP_KEY) || 0);
        if (localStorage.getItem(NO_REMIND_KEY) !== "1" && Date.now() - last > REMIND_MS) {
          localStorage.setItem(POP_KEY, String(Date.now()));
          setTimeout(() => alive && setOpen(true), 1200);
        }
      })
      .catch(() => alive && setNotice({ show: false }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!notice?.show) return null;
  const n = notice;

  function dismissPill() {
    localStorage.setItem(PILL_KEY, "dismissed");
    setPill(false);
    if (n.state !== "guest") fetch("/api/me/welcome/dismiss", { method: "POST" }).catch(() => undefined);
  }

  function noRemind() {
    localStorage.setItem(NO_REMIND_KEY, "1");
    close();
  }

  function close() {
    setOpen(false);
    setClaimed(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(n.link || n.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the link is still selectable */
    }
  }

  const pct = n.required ? Math.round((n.qualified / n.required) * 100) : 0;

  return (
    <>
      {pill ? (
        <div className="reward-pill">
          <button type="button" className="reward-pill-link" onClick={() => setOpen(true)}>
            <Gift className="h-3.5 w-3.5" aria-hidden /> {n.title}
          </button>
          <button type="button" className="reward-pill-x" aria-label="Dismiss reward" onClick={dismissPill}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="reward-pop-backdrop" role="presentation" onClick={close}>
          <div className="reward-pop" role="dialog" aria-modal="true" aria-labelledby="reward-pop-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="reward-pop-close" aria-label="Close" onClick={close}>
              <X className="h-4 w-4" />
            </button>
            <div className="reward-pop-badge"><Gift className="h-6 w-6" /></div>
            <p className="reward-pop-kicker">Welcome reward</p>
            <h2 id="reward-pop-title" className="reward-pop-amount">{n.amountLabel}</h2>

            {!claimed ? (
              <>
                <p className="reward-pop-copy">A welcome gift for new members. Tap claim to see how to get it.</p>
                <ol className="reward-pop-steps">
                  <Step done={n.state !== "guest"} icon={<UserPlus className="h-4 w-4" />} label="Sign up" />
                  <Step done={n.state === "refer"} icon={<BadgeCheck className="h-4 w-4" />} label="Verify your account" />
                  <Step done={false} icon={<Users className="h-4 w-4" />} label={`Refer ${n.required} people`} />
                </ol>
                {n.state === "refer" ? (
                  <Link href="/promo/5k" className="reward-pop-cta">Claim {n.title.replace(" Reward", "")}</Link>
                ) : (
                  <button type="button" className="reward-pop-cta" onClick={() => setClaimed(true)}>Claim {n.title.replace(" Reward", "")}</button>
                )}
                <button type="button" className="reward-pop-later" onClick={close}>Not now</button>
                <button type="button" className="reward-pop-never" onClick={noRemind}>Don&apos;t remind me again</button>
              </>
            ) : n.state === "guest" ? (
              <>
                <p className="reward-pop-copy">Create your free account to claim it. It takes a minute.</p>
                <Link href="/signup" className="reward-pop-cta">Sign up to claim</Link>
                <Link href="/login" className="reward-pop-later">I already have an account</Link>
              </>
            ) : n.state === "verify" ? (
              <>
                <p className="reward-pop-copy">Verify your account, then come back to claim your reward.</p>
                <Link href="/verify" className="reward-pop-cta">Verify now</Link>
                <button type="button" className="reward-pop-later" onClick={close}>Remind me later</button>
              </>
            ) : (
              <>
                <p className="reward-pop-copy">You&apos;re verified. Refer {n.required} people who sign up and verify, then withdraw your {n.amountLabel}.</p>
                <div className="reward-pop-progress" aria-label={`${n.qualified} of ${n.required} referrals`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Referrals</span>
                    <span>{n.qualified}/{n.required}</span>
                  </div>
                  <div className="reward-pop-bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
                {n.link ? (
                  <div className="reward-pop-link">
                    <span className="truncate">{n.link}</span>
                    <button type="button" onClick={copy} aria-label="Copy referral link">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                ) : null}
                {n.code ? <p className="reward-pop-code">Your code: <strong>{n.code}</strong></p> : null}
                <Link href={n.href} className="reward-pop-cta">Open referral dashboard</Link>
                <button type="button" className="reward-pop-later" onClick={close}>Close</button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Step({ done, icon, label }: { done: boolean; icon: React.ReactNode; label: string }) {
  return (
    <li className={done ? "is-done" : ""}>
      <span className="reward-pop-step-icon">{done ? <Check className="h-4 w-4" /> : icon}</span>
      {label}
    </li>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";

type Step = { key: string; label: string; state: "passed" | "pending" | "failed" };
type Referral = { id: string; name: string; steps: Step[]; hint: string; qualified: boolean; overall: string };
type Dash = {
  closed: boolean;
  closedMessage: string;
  female: boolean;
  hasProfile: boolean;
  rewardLabel: string;
  required: number;
  ownSteps: Step[];
  ownHint: string;
  reward: { status: string; statusLabel: string; canWithdraw: boolean; amountLabel: string } | null;
  qualified: number;
  counterLabel: string;
  prompt: string;
  code: string;
  link: string;
  referrals: Referral[];
};

function mark(state: Step["state"]) {
  if (state === "passed") return "✓ Completed";
  if (state === "failed") return "✗ Failed";
  return "⏳ Pending";
}

export default function WelcomeRewardCard() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  function load() {
    fetch("/api/me/welcome", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return setError(body.error ?? "Could not load the welcome reward.");
        setDash(body.welcome ?? null);
      })
      .catch(() => setError("Could not load the welcome reward."));
  }

  useEffect(() => {
    load();
  }, []);

  async function post(url: string, payload: unknown, busyKey: string) {
    setBusy(busyKey);
    setError("");
    setNotice("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setBusy("");
    if (!response?.ok) {
      setError(body.error ?? "That did not work. Try again.");
      return false;
    }
    return true;
  }

  if (!dash) {
    return error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null;
  }
  if (!dash.female && dash.hasProfile && !dash.reward) return null;
  if (dash.closed) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-xl font-bold">Welcome Reward Campaign Closed</h2>
      </section>
    );
  }

  const phoneDone = dash.ownSteps.find((step) => step.key === "phone")?.state === "passed";
  const identityDone = dash.ownSteps.filter((step) => step.key === "liveness").every((step) => step.state === "passed");

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-5">
      <p className="text-[11px] uppercase tracking-wide text-muted">Welcome Reward</p>
      <h2 className="font-display mt-1 text-2xl font-bold">{dash.reward?.amountLabel ?? dash.rewardLabel} Welcome Reward</h2>
      <p className="mt-2 text-sm text-muted">
        {dash.reward ? dash.reward.statusLabel : dash.ownHint || "Finish every verification step to receive this reward. Registration alone does not qualify."}
      </p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted">Reward status</dt>
          <dd className="mt-1 font-display text-lg font-bold">{dash.reward ? (dash.reward.status === "LOCKED" ? "Locked" : dash.reward.status === "UNLOCKED" ? "Unlocked" : dash.reward.status === "WITHDRAWN" ? "Withdrawn" : "Requested") : "Not issued"}</dd>
        </div>
        <div className="rounded-xl border border-line px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted">Verified referrals</dt>
          <dd className="mt-1 font-display text-lg font-bold">{dash.counterLabel}</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1 text-sm">
        {dash.ownSteps.map((step) => (
          <li key={step.key} className="flex justify-between gap-3">
            <span>{step.label}</span>
            <span className={step.state === "passed" ? "text-emerald-300" : step.state === "failed" ? "text-red-300" : "text-muted"}>{mark(step.state)}</span>
          </li>
        ))}
      </ul>

      {!phoneDone ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!sent) {
              const ok = await post("/api/me/welcome/phone", { action: "send", phone }, "send");
              if (ok) {
                setSent(true);
                setNotice("We sent a code by SMS. Enter it below.");
              }
              return;
            }
            const ok = await post("/api/me/welcome/phone", { action: "confirm", code }, "confirm");
            if (ok) {
              setNotice("Phone verification completed.");
              load();
            }
          }}
        >
          <h3 className="font-display text-sm font-bold">Phone verification</h3>
          {!sent ? (
            <input className="input" inputMode="tel" placeholder="Nigerian phone number" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          ) : (
            <input className="input" inputMode="numeric" placeholder="SMS code" value={code} onChange={(event) => setCode(event.target.value)} required />
          )}
          <button className="btn-primary text-sm" type="submit" disabled={!!busy}>
            {busy === "send" || busy === "confirm" ? "Please wait…" : sent ? "Confirm code" : "Send code"}
          </button>
        </form>
      ) : null}

      {!identityDone ? (
        <p className="mt-4 text-sm text-muted">
          Face verification: upload a photo and take a quick live selfie.{" "}
          <Link href="/verify" className="underline">Verify my face</Link>
        </p>
      ) : null}

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-muted">Referral link</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded-xl border border-line bg-black/30 px-3 py-2 text-sm">{dash.link}</code>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(dash.link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">Referral code: <strong className="text-ink">{dash.code}</strong></p>
      </div>

      <p className="mt-4 text-sm">{dash.prompt}</p>

      <ul className="mt-4 space-y-3">
        {dash.referrals.length === 0 ? (
          <li className="text-sm text-muted">No referrals yet. Share your link. A signup alone does not count.</li>
        ) : dash.referrals.map((row) => (
          <li key={row.id} className="rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <strong>Referral: {row.name}</strong>
              <span className="text-xs text-muted">{row.overall}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {row.steps.map((step) => (
                <li key={step.key} className="flex justify-between gap-3">
                  <span>{step.label}</span>
                  <span>{mark(step.state)}</span>
                </li>
              ))}
            </ul>
            {row.hint ? <p className="mt-2 text-sm text-muted">{row.hint}</p> : null}
          </li>
        ))}
      </ul>

      {dash.reward?.canWithdraw ? (
        <form
          className="mt-5 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await post("/api/me/welcome/withdraw", { accountName, accountNumber, bankName }, "withdraw");
            if (ok) {
              setNotice("Withdrawal requested. We will review it.");
              load();
            }
          }}
        >
          <h3 className="font-display text-sm font-bold">Withdraw {dash.reward.amountLabel}</h3>
          <input className="input" placeholder="Account name" value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
          <input className="input" placeholder="Account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} required />
          <input className="input" placeholder="Bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} required />
          <button className="btn-primary text-sm" type="submit" disabled={busy === "withdraw"}>Request withdrawal</button>
        </form>
      ) : null}
    </section>
  );
}

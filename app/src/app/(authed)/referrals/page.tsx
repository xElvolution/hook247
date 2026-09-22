"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import MoneyInput, { parseNairaInput } from "@/components/MoneyInput";

type HistoryRow = {
  id: string;
  planName: string;
  paymentNumber: number;
  percent: number;
  amountLabel: string;
  status: string;
  transactionRef: string;
  createdAt: string;
};

type Dash = {
  link: string;
  code: string;
  totalReferrals: number;
  payingReferrals: number;
  pendingLabel: string;
  availableLabel: string;
  earnedLabel: string;
  withdrawnLabel: string;
  availableKobo: number;
  history: HistoryRow[];
};

export default function ReferralsPage() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [guest, setGuest] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [amount, setAmount] = useState("");

  function load() {
    fetch("/api/me/referral")
      .then(async (response) => {
        if (response.status === 401) {
          setGuest(true);
          return;
        }
        const data = await response.json();
        setDash(data.referral ?? null);
        if (!data.referral) setError(data.error ?? "Could not load referrals.");
      })
      .catch(() => setError("Could not load referrals."));
  }

  useEffect(() => {
    load();
  }, []);

  async function withdraw(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const naira = parseNairaInput(amount) ?? 0;
    const res = await fetch("/api/me/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountKobo: Math.round(naira * 100),
        accountName,
        accountNumber,
        bankName,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Withdrawal failed.");
      return;
    }
    setAmount("");
    load();
  }

  if (guest) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Referrals</h1>
        <p className="mt-2 text-sm text-muted">
          Log in to open your referral dashboard, copy your link, and track commissions.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/login?next=/referrals" className="btn-primary text-sm">
            Log in
          </Link>
          <Link href="/signup" className="btn-ghost text-sm">
            Sign up to get hooked
          </Link>
        </div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold">Referrals</h1>
        <p className="mt-2 text-sm text-muted">{error || "Loading referral dashboard…"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Referrals</h1>
      <p className="mt-2 text-sm text-muted">
        One level only. You earn when someone you referred pays a profile plan.
        You do not earn from people they refer.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <code className="flex-1 truncate rounded-xl border border-line bg-black/30 px-4 py-3 text-sm">
          {dash.link}
        </code>
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

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Total referrals", dash.totalReferrals],
          ["Paying referrals", dash.payingReferrals],
          ["Pending", dash.pendingLabel],
          ["Available", dash.availableLabel],
          ["Total earned", dash.earnedLabel],
          ["Withdrawn", dash.withdrawnLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 font-display text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={(event) => void withdraw(event)} className="mt-8 space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="font-display text-xl font-bold">Withdraw available</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input className="input" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        <input className="input" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
        <input className="input" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
        <MoneyInput
          className="input"
          placeholder="Amount in naira, e.g. 100,000"
          value={amount}
          onChange={(naira) => setAmount(naira ? String(naira) : "")}
          required
        />
        <button className="btn-primary text-sm" disabled={busy} type="submit">
          {busy ? "Sending…" : "Request withdrawal"}
        </button>
      </form>

      <h2 className="font-display mt-10 text-xl font-bold">Commission history</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {dash.history.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={5}>
                  No commissions yet.
                </td>
              </tr>
            ) : (
              dash.history.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{row.planName || "Subscription"}</td>
                  <td className="px-3 py-2">{row.paymentNumber}</td>
                  <td className="px-3 py-2">{row.amountLabel} ({row.percent}%)</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

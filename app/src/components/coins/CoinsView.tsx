"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Coins,
  Landmark,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { coinCount, naira } from "./format";
import WithdrawConfirmModal, { type WithdrawQuote } from "./WithdrawConfirmModal";
import "./withdraw-confirm.css";

type Pack = { id: string; name: string; coins: number; priceKobo: number };
type Tx = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  counterparty: string | null;
  source: string;
  note: string;
  at: string;
};
type Withdrawal = {
  id: string;
  coins: number;
  amountKobo: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
  bankName: string;
  accountNumber: string;
  accountName: string;
  adminNote: string;
  at: string;
};
type CoinData = {
  wallet: { balance: number; held: number; lifetimeEarned: number };
  isEscort: boolean;
  packs: Pack[];
  settings: { minWithdrawalCoins: number } | null;
  transactions: Tx[];
  withdrawals: Withdrawal[];
  payoutAccount: { bankCode: string; bankName: string; accountNumber: string; accountName: string } | null;
};

const TX_LABEL: Record<string, string> = {
  PURCHASE: "Bought coins",
  TIP_SENT: "Tip sent",
  TIP_RECEIVED: "Tip received",
  WITHDRAWAL_REQUEST: "Withdrawal requested",
  WITHDRAWAL_PAID: "Withdrawal paid",
  WITHDRAWAL_REFUND: "Withdrawal refunded",
  ADMIN_ADJUST: "Adjustment",
};

const STATUS_LABEL: Record<Withdrawal["status"], string> = {
  REQUESTED: "Processing",
  APPROVED: "Sending",
  PAID: "Paid",
  REJECTED: "Refunded",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function CoinsView({ returnReference }: { returnReference: string }) {
  const [data, setData] = useState<CoinData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyPack, setBusyPack] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(Boolean(returnReference));

  const load = useCallback(async () => {
    const response = await fetch("/api/coins", { cache: "no-store" }).catch(() => null);
    if (!response) return setLoadError("You seem to be offline. Pull to refresh or try again.");
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setLoadError(body.error ?? "Coins could not load.");
    setLoadError("");
    setData(body);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Back from Paystack: confirm the payment, retrying briefly while Paystack settles.
  useEffect(() => {
    if (!returnReference) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const response = await fetch("/api/coins/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: returnReference }),
        }).catch(() => null);
        const body = response ? await response.json().catch(() => ({})) : {};
        if (body.ok) {
          setNotice(`${coinCount(body.coins)} coins added to your wallet.`);
          break;
        }
        if (body.state === "failed" || response?.status === 404 || response?.status === 400) {
          setError(body.error ?? "That payment did not go through. You were not charged coins.");
          break;
        }
        if (attempt === 4) setNotice("Payment is still being confirmed. Your coins will appear here as soon as Paystack confirms it.");
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!cancelled) {
        setVerifying(false);
        window.history.replaceState(null, "", "/coins");
        void load();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [returnReference, load]);

  async function buy(pack: Pack) {
    setBusyPack(pack.id);
    setError("");
    const response = await fetch("/api/coins/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId: pack.id }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok || !body.checkoutUrl) {
      setBusyPack("");
      setError(body.error ?? "Could not start checkout. Try again.");
      return;
    }
    window.location.assign(body.checkoutUrl);
  }

  const baseRate = useMemo(() => {
    if (!data?.packs.length) return 0;
    const smallest = [...data.packs].sort((a, b) => a.coins - b.coins)[0];
    return smallest.priceKobo / smallest.coins;
  }, [data]);

  if (loadError && !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="empty-panel flex min-h-56 flex-col items-center justify-center px-6 text-center">
          <Coins className="h-8 w-8 text-[#df3a6a]" />
          <p className="mt-3 text-sm text-muted">{loadError}</p>
          <button type="button" className="section-link mt-3" onClick={() => void load()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-36 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />)}
        </div>
      </div>
    );
  }

  const bestPack = [...data.packs].sort((a, b) => a.priceKobo / a.coins - b.priceKobo / b.coins)[0];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="section-kicker"><Coins className="h-3.5 w-3.5" /> Wallet</p>
      <h1 className="font-display mt-2 text-2xl font-extrabold">Coins</h1>

      <section className="coin-balance-card mt-4">
        <div>
          <p>Your balance</p>
          <strong><Coins className="h-6 w-6" /> {coinCount(data.wallet.balance)}</strong>
          {data.wallet.held > 0 ? <small>{coinCount(data.wallet.held)} coins held for a withdrawal</small> : null}
        </div>
        {data.isEscort ? (
          <div className="coin-balance-side">
            <p>Earned in tips</p>
            <strong><TrendingUp className="h-4 w-4" /> {coinCount(data.wallet.lifetimeEarned)}</strong>
            <small>coins all time</small>
          </div>
        ) : (
          <a href="#buy-coins" className="coin-balance-topup"><Plus className="h-3.5 w-3.5" /> Top up</a>
        )}
      </section>

      {verifying ? (
        <p className="coin-flash mt-4" data-tone="info"><Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment...</p>
      ) : null}
      {notice ? <p className="coin-flash mt-4" data-tone="good"><CheckCircle2 className="h-4 w-4" /> {notice}</p> : null}
      {error ? <p className="coin-flash mt-4" data-tone="bad">{error}</p> : null}

      <h2 id="buy-coins" className="font-display mt-7 scroll-mt-24 text-lg font-bold">Buy coins</h2>
      <p className="mt-1 text-sm text-muted">Send tips to escorts from their profile, posts and live rooms. Paid securely with Paystack.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {data.packs.map((pack) => {
          const saving = baseRate ? Math.round((1 - pack.priceKobo / pack.coins / baseRate) * 100) : 0;
          return (
            <div key={pack.id} className="coin-pack" data-best={pack.id === bestPack?.id && data.packs.length > 1}>
              {pack.id === bestPack?.id && data.packs.length > 1 ? <span className="coin-pack-ribbon"><Sparkles className="h-3 w-3" /> Best value</span> : null}
              <p className="coin-pack-coins"><Coins className="h-5 w-5" /> {coinCount(pack.coins)}</p>
              <p className="coin-pack-name">{pack.name}</p>
              <p className="coin-pack-price">{naira(pack.priceKobo)}</p>
              <p className="coin-pack-save">{saving > 0 ? `Save ${saving}%` : `${naira(pack.priceKobo / pack.coins)} per coin`}</p>
              <button type="button" className="btn-primary mt-3 w-full text-xs" disabled={!!busyPack} onClick={() => void buy(pack)}>
                {busyPack === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
              </button>
            </div>
          );
        })}
      </div>

      {data.isEscort && data.settings ? (
        <WithdrawSection data={data} onDone={load} />
      ) : null}

      <h2 className="font-display mt-8 text-lg font-bold">Activity</h2>
      {data.transactions.length ? (
        <ul className="coin-activity mt-3">
          {data.transactions.map((tx) => (
            <li key={tx.id}>
              <span className="coin-activity-icon" data-dir={tx.amount >= 0 ? "in" : "out"}>
                {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <strong>
                  {TX_LABEL[tx.type] ?? tx.type}
                  {tx.counterparty ? (tx.type === "TIP_SENT" ? ` to ${tx.counterparty}` : ` from ${tx.counterparty}`) : ""}
                  {tx.source === "live" && tx.type.startsWith("TIP") ? " (live gift)" : ""}
                </strong>
                <small>{when(tx.at)}{tx.type === "ADMIN_ADJUST" || tx.type.startsWith("WITHDRAWAL") ? ` · ${tx.note}` : ""}</small>
              </span>
              <span className="coin-activity-amount" data-dir={tx.amount > 0 ? "in" : tx.amount < 0 ? "out" : "none"}>
                {tx.amount > 0 ? "+" : ""}{coinCount(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No coin activity yet. Buy a pack to start tipping.</p>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Coins are for tipping on Hooks247 and cannot be refunded once sent. <Link href="/faqs" className="underline">FAQs</Link>
      </p>
    </div>
  );
}

function WithdrawSection({ data, onDone }: { data: CoinData; onDone: () => Promise<void> }) {
  const settings = data.settings!;
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankError, setBankError] = useState("");
  const [bankCode, setBankCode] = useState(data.payoutAccount?.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState(data.payoutAccount?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(data.payoutAccount?.accountName ?? "");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [amount, setAmount] = useState(String(Math.max(settings.minWithdrawalCoins, 0)));
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<WithdrawQuote | null>(null);
  const [modalError, setModalError] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    fetch("/api/coins/banks")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setBanks(b.banks ?? []) : setBankError(b.error ?? "Could not load banks.")))
      .catch(() => setBankError("Could not load banks."));
  }, []);

  // Resolve the account name as soon as a full account number and bank are set.
  useEffect(() => {
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return;
    if (data.payoutAccount && data.payoutAccount.accountNumber === accountNumber && data.payoutAccount.bankCode === bankCode) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setResolving(true);
      setResolveError("");
      setAccountName("");
      const response = await fetch("/api/coins/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      }).catch(() => null);
      const body = response ? await response.json().catch(() => ({})) : {};
      if (cancelled) return;
      setResolving(false);
      if (response?.ok) setAccountName(body.accountName);
      else setResolveError(body.error ?? "We could not find that account.");
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accountNumber, bankCode, data.payoutAccount]);

  const coins = Math.floor(Number(amount) || 0);
  const open = data.withdrawals.find((w) => w.status === "REQUESTED" || w.status === "APPROVED");
  const tooLow = coins < settings.minWithdrawalCoins;
  const tooHigh = coins > data.wallet.balance;
  const accountReady = !!accountName && !!bankCode && /^\d{10}$/.test(accountNumber);
  const canSubmit = !open && !busy && !quoting && !tooLow && !tooHigh && accountReady;
  const bankName = banks.find((b) => b.code === bankCode)?.name ?? (data.payoutAccount?.bankCode === bankCode ? data.payoutAccount.bankName : "");

  const amountHint = !amount
    ? `Minimum ${coinCount(settings.minWithdrawalCoins)} coins`
    : tooHigh
      ? `That is more than your balance of ${coinCount(data.wallet.balance)} coins`
      : tooLow
        ? `The minimum withdrawal is ${coinCount(settings.minWithdrawalCoins)} coins`
        : `${coinCount(data.wallet.balance - coins)} coins will stay in your wallet`;

  // Ask the server what this withdrawal pays, then show the confirm step.
  async function review(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setQuoting(true);
    setError("");
    setDone("");
    const response = await fetch("/api/coins/withdraw/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setQuoting(false);
    if (!response?.ok || typeof body.amountKobo !== "number") {
      setError(body.error ?? "We could not work out your payout. Try again.");
      return;
    }
    setModalError("");
    setModalNotice("");
    setQuote({ coins: body.coins, amountKobo: body.amountKobo });
  }

  async function confirm() {
    if (!quote || busy) return;
    setBusy(true);
    setModalError("");
    setModalNotice("");
    const response = await fetch("/api/coins/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins: quote.coins, bankCode, accountNumber, expectedAmountKobo: quote.amountKobo }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (response?.status === 409 && body.quote && typeof body.quote.amountKobo === "number") {
      setQuote({ coins: body.quote.coins, amountKobo: body.quote.amountKobo });
      setModalNotice("The payout amount was just updated. Check the new figure and confirm again.");
      return;
    }
    if (!response?.ok) {
      setModalError(body.error ?? "The withdrawal could not be requested. Try again.");
      return;
    }
    setQuote(null);
    setDone(
      `Withdrawal of ${coinCount(body.coins ?? quote.coins)} coins requested. We will send ${naira(body.amountKobo ?? quote.amountKobo)} to ${body.accountName || accountName} once it is approved.`
    );
    await onDone();
  }

  return (
    <section className="coin-withdraw mt-8">
      <h2 className="font-display flex items-center gap-2 text-lg font-bold"><Banknote className="h-5 w-5 text-[#df3a6a]" /> Withdraw earnings</h2>
      <p className="mt-1 text-sm text-muted">
        Cash out the coins you earn from tips and live gifts. The minimum withdrawal is {coinCount(settings.minWithdrawalCoins)} coins.
        You will see exactly what you receive before you confirm.
      </p>

      {open ? (
        <p className="coin-flash mt-4" data-tone="info">
          <Loader2 className="h-4 w-4 animate-spin" /> {coinCount(open.coins)} coins ({naira(open.amountKobo)}) to {open.accountName} is being processed.
        </p>
      ) : (
        <form onSubmit={review} className="mt-4 space-y-3">
          <label className="coin-field">
            <span>Bank</span>
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} disabled={!banks.length}>
              <option value="">{banks.length ? "Choose your bank" : bankError || "Loading banks..."}</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </label>
          <label className="coin-field">
            <span>Account number</span>
            <input inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" />
          </label>
          <p className="coin-account-name">
            <Landmark className="h-4 w-4" />
            {resolving ? "Checking account..." : accountName ? accountName : resolveError || "Account name appears here"}
          </p>
          <label className="coin-field">
            <span>Coins to withdraw</span>
            <input inputMode="numeric" value={amount} aria-invalid={!!amount && (tooHigh || tooLow)} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </label>
          <p className="coin-withdraw-hint text-xs text-muted" data-tone={amount && (tooHigh || tooLow) ? "bad" : undefined} aria-live="polite">
            {amountHint}
          </p>
          {error ? <p className="coin-flash" data-tone="bad">{error}</p> : null}
          <button type="submit" className="btn-primary w-full text-sm" disabled={!canSubmit}>
            {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Withdraw"}
          </button>
        </form>
      )}
      {quote ? (
        <WithdrawConfirmModal
          quote={quote}
          bankName={bankName}
          accountNumber={accountNumber}
          accountName={accountName}
          busy={busy}
          error={modalError}
          notice={modalNotice}
          onConfirm={() => void confirm()}
          onCancel={() => setQuote(null)}
        />
      ) : null}
      {done ? <p className="coin-flash mt-3" data-tone="good"><CheckCircle2 className="h-4 w-4" /> {done}</p> : null}

      {data.withdrawals.length ? (
        <ul className="coin-activity mt-4">
          {data.withdrawals.map((w) => (
            <li key={w.id}>
              <span className="min-w-0 flex-1">
                <strong>{coinCount(w.coins)} coins · {naira(w.amountKobo)}</strong>
                <small>{w.bankName} {w.accountNumber} · {when(w.at)}{w.adminNote ? ` · ${w.adminNote}` : ""}</small>
              </span>
              <span className="coin-status" data-status={w.status}>{STATUS_LABEL[w.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

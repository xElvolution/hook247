"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Coins,
  Gift,
  History,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  ShieldAlert,
  Star,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { coinCount, naira } from "./format";
import WithdrawConfirmModal, { type WithdrawQuote } from "./WithdrawConfirmModal";
import "./withdraw-confirm.css";

type Pack = { id: string; name: string; coins: number; priceKobo: number };
type Purchase = { id: string; coins: number; amountKobo: number; status: string; reference: string; at: string };
type GiftSent = { id: string; to: string; toAvatar: string; giftName: string; emoji: string; coins: number; source: string; status: string; at: string };
type GiftReceived = {
  id: string;
  from: string;
  fromAvatar: string;
  giftName: string;
  emoji: string;
  coins: number;
  amountKobo: number;
  shareKobo: number;
  source: string;
  status: string;
  at: string;
};
type Account = { id: string; bankCode: string; bankName: string; accountNumber: string; accountName: string; isDefault: boolean };
type Withdrawal = {
  id: string;
  source: string;
  coins: number;
  grossKobo: number;
  feeKobo: number;
  payoutKobo: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PAID";
  bankName: string;
  accountNumber: string;
  accountName: string;
  adminNote: string;
  at: string;
};
type ClientData = {
  role: "CLIENT";
  coinPriceKobo: number;
  wallet: { balance: number };
  packs: Pack[];
  purchases: Purchase[];
  giftsSent: GiftSent[];
};
type EscortData = {
  role: "ESCORT";
  coinPriceKobo: number;
  eligibility: { paid: boolean; planExpiresAt: string | null; payoutsFrozen: boolean; giftingDisabled: boolean };
  feeBps: number;
  manualApproval: boolean;
  earnings: { balanceKobo: number; heldKobo: number; lifetimeKobo: number; withdrawnKobo: number };
  legacyCoins: number;
  giftsReceived: GiftReceived[];
  accounts: Account[];
  withdrawals: Withdrawal[];
};
type CoinData = ClientData | EscortData;

const PURCHASE_LABEL: Record<string, string> = { SUCCESS: "Paid", PENDING: "Pending", FAILED: "Failed", ABANDONED: "Not completed" };
const STATUS_LABEL: Record<Withdrawal["status"], string> = {
  REQUESTED: "Awaiting approval",
  APPROVED: "Sending",
  PAID: "Paid",
  REJECTED: "Declined, refunded",
};
const SOURCE_LABEL: Record<string, string> = { live: "Live", profile: "Profile", post: "Post" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function masked(accountNumber: string) {
  return accountNumber ? `****${accountNumber.slice(-4)}` : "";
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="pulse-tabs coin-tabs mt-5" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} data-active={value === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="coin-empty mt-4">
      {icon}
      <p>{text}</p>
    </div>
  );
}

export default function CoinsView({ returnReference }: { returnReference: string }) {
  const [data, setData] = useState<CoinData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(Boolean(returnReference));

  const load = useCallback(async () => {
    const response = await fetch("/api/coins", { cache: "no-store" }).catch(() => null);
    if (!response) return setLoadError("You seem to be offline. Check your connection and try again.");
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setLoadError(body.error ?? "Your wallet could not load.");
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
          setNotice(`${coinCount(body.coins)} coins added to your Coin Wallet.`);
          break;
        }
        if (body.state === "failed" || response?.status === 404 || response?.status === 400) {
          setError(body.error ?? "That payment did not go through, so no coins were added.");
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

  if (loadError && !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="empty-panel flex min-h-56 flex-col items-center justify-center px-6 text-center">
          <Wallet className="h-8 w-8 text-[#df3a6a]" />
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

  const flashes = (
    <>
      {verifying ? <p className="coin-flash mt-4" data-tone="info"><Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment...</p> : null}
      {notice ? <p className="coin-flash mt-4" data-tone="good"><CheckCircle2 className="h-4 w-4" /> {notice}</p> : null}
      {error ? <p className="coin-flash mt-4" data-tone="bad">{error}</p> : null}
    </>
  );

  return data.role === "ESCORT" ? (
    <EscortWallet data={data} flashes={flashes} reload={load} />
  ) : (
    <ClientWallet data={data} flashes={flashes} onError={setError} />
  );
}

// ---------------------------------------------------------------- client

function ClientWallet({ data, flashes, onError }: { data: ClientData; flashes: React.ReactNode; onError: (m: string) => void }) {
  const [tab, setTab] = useState<"wallet" | "purchases" | "gifts">("wallet");
  const [busyPack, setBusyPack] = useState("");

  async function buy(pack: Pack) {
    setBusyPack(pack.id);
    onError("");
    const response = await fetch("/api/coins/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId: pack.id }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok || !body.checkoutUrl) {
      setBusyPack("");
      onError(body.error ?? "Could not start checkout. Try again.");
      return;
    }
    window.location.assign(body.checkoutUrl);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="section-kicker"><Coins className="h-3.5 w-3.5" /> Wallet</p>
      <h1 className="font-display mt-2 text-2xl font-extrabold">Coin Wallet</h1>

      <section className="coin-balance-card mt-4">
        <div>
          <p>Your coins</p>
          <strong><Coins className="h-6 w-6" /> {coinCount(data.wallet.balance)}</strong>
          <small>1 coin = {naira(data.coinPriceKobo)}</small>
        </div>
        <button type="button" className="coin-balance-topup" onClick={() => { setTab("wallet"); document.getElementById("buy-coins")?.scrollIntoView({ behavior: "smooth" }); }}>
          <Plus className="h-3.5 w-3.5" /> Top up
        </button>
      </section>

      {flashes}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "wallet", label: "Buy coins" },
          { id: "purchases", label: "Purchase history" },
          { id: "gifts", label: "Gifts sent" },
        ]}
      />

      {tab === "wallet" ? (
        <>
          <h2 id="buy-coins" className="font-display mt-6 scroll-mt-24 text-lg font-bold">Buy coins</h2>
          <p className="mt-1 text-sm text-muted">
            Every coin costs {naira(data.coinPriceKobo)}. Use coins to send gifts to escorts during their lives, on their profile and on their posts. Paid securely with Paystack.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {data.packs.map((pack) => (
              <div key={pack.id} className="coin-pack">
                <p className="coin-pack-coins"><Coins className="h-5 w-5" /> {coinCount(pack.coins)}</p>
                <p className="coin-pack-name">{pack.name}</p>
                <p className="coin-pack-price">{naira(pack.priceKobo)}</p>
                <p className="coin-pack-save">{naira(data.coinPriceKobo)} per coin</p>
                <button type="button" className="btn-primary mt-3 w-full text-xs" disabled={!!busyPack} onClick={() => void buy(pack)}>
                  {busyPack === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "purchases" ? (
        data.purchases.length ? (
          <ul className="coin-activity mt-4">
            {data.purchases.map((p) => (
              <li key={p.id}>
                <span className="coin-activity-icon" data-dir="in"><ReceiptText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <strong>{coinCount(p.coins)} coins for {naira(p.amountKobo)}</strong>
                  <small>{when(p.at)} · Ref {p.reference.slice(-10)}</small>
                </span>
                <span className="coin-status" data-status={p.status === "SUCCESS" ? "PAID" : p.status === "PENDING" ? "REQUESTED" : "REJECTED"}>
                  {PURCHASE_LABEL[p.status] ?? p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<ReceiptText className="h-6 w-6" />} text="No purchases yet. Buy a pack to start sending gifts." />
        )
      ) : null}

      {tab === "gifts" ? (
        data.giftsSent.length ? (
          <ul className="coin-activity mt-4">
            {data.giftsSent.map((g) => (
              <li key={g.id}>
                <span className="coin-activity-icon coin-gift-emoji" data-dir="out">{g.emoji || <Gift className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1">
                  <strong>{g.giftName} to {g.to}</strong>
                  <small>{when(g.at)} · {SOURCE_LABEL[g.source] ?? g.source}</small>
                </span>
                <span className="coin-activity-amount" data-dir="out">-{coinCount(g.coins)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={<Gift className="h-6 w-6" />} text="Gifts you send will show here." />
        )
      ) : null}

      <p className="mt-8 text-center text-xs text-muted">
        Coins are for gifting on Hooks247 only. They cannot be converted to cash or refunded once sent. <Link href="/faqs" className="underline">FAQs</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- escort

function EscortWallet({ data, flashes, reload }: { data: EscortData; flashes: React.ReactNode; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<"withdraw" | "gifts" | "accounts" | "history">("withdraw");
  const { eligibility, earnings } = data;
  const expires = eligibility.planExpiresAt ? new Date(eligibility.planExpiresAt) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="section-kicker"><Wallet className="h-3.5 w-3.5" /> Wallet</p>
      <h1 className="font-display mt-2 text-2xl font-extrabold">Earnings Wallet</h1>

      <section className="coin-balance-card mt-4">
        <div>
          <p>Available to withdraw</p>
          <strong><Wallet className="h-6 w-6" /> {naira(earnings.balanceKobo)}</strong>
          {earnings.heldKobo > 0 ? <small>{naira(earnings.heldKobo)} held for a withdrawal in progress</small> : <small>Your share of every gift lands here</small>}
        </div>
        <div className="coin-balance-side">
          <p>Earned all time</p>
          <strong><TrendingUp className="h-4 w-4" /> {naira(earnings.lifetimeKobo)}</strong>
          <small>{naira(earnings.withdrawnKobo)} withdrawn</small>
        </div>
      </section>

      {eligibility.paid ? (
        <p className="coin-flash mt-4" data-tone="good">
          <Star className="h-4 w-4" /> Your plan is active{expires ? ` until ${expires.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}. You can go live, receive gifts and withdraw.
        </p>
      ) : (
        <p className="coin-flash mt-4" data-tone="info">
          <ShieldAlert className="h-4 w-4" />
          <span>
            You need an active paid plan to go live, receive gifts and withdraw. Your balance stays safe in the meantime.{" "}
            <Link href="/premium" className="underline">See plans</Link>
          </span>
        </p>
      )}
      {eligibility.payoutsFrozen ? (
        <p className="coin-flash mt-3" data-tone="bad">Withdrawals are on hold for your account. Contact support for help.</p>
      ) : null}
      {eligibility.giftingDisabled ? (
        <p className="coin-flash mt-3" data-tone="bad">Gifting is turned off for your account. Contact support for help.</p>
      ) : null}
      {data.legacyCoins > 0 ? (
        <p className="coin-flash mt-3" data-tone="info">
          <Coins className="h-4 w-4" /> You have {coinCount(data.legacyCoins)} coins from before earnings moved to naira. Our team will convert them into your Earnings Wallet.
        </p>
      ) : null}

      {flashes}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "withdraw", label: "Withdraw" },
          { id: "gifts", label: "Gifts received" },
          { id: "accounts", label: "Withdrawal accounts" },
          { id: "history", label: "Withdrawal history" },
        ]}
      />

      {tab === "withdraw" ? <WithdrawPanel data={data} reload={reload} onManageAccounts={() => setTab("accounts")} /> : null}
      {tab === "gifts" ? <GiftsReceived gifts={data.giftsReceived} /> : null}
      {tab === "accounts" ? <AccountsPanel initial={data.accounts} reload={reload} /> : null}
      {tab === "history" ? <WithdrawalHistory withdrawals={data.withdrawals} /> : null}

      <p className="mt-8 text-center text-xs text-muted">
        Earnings are your share of the gifts you receive, in naira. Coins themselves cannot be converted to cash. <Link href="/faqs" className="underline">FAQs</Link>
      </p>
    </div>
  );
}

function GiftsReceived({ gifts }: { gifts: GiftReceived[] }) {
  if (!gifts.length) return <Empty icon={<Gift className="h-6 w-6" />} text="Gifts you receive during lives and on your profile will show here." />;
  return (
    <ul className="coin-activity mt-4">
      {gifts.map((g) => (
        <li key={g.id}>
          <span className="coin-activity-icon coin-gift-emoji" data-dir="in">{g.emoji || <Gift className="h-4 w-4" />}</span>
          <span className="min-w-0 flex-1">
            <strong>{g.giftName} from {g.from}</strong>
            <small>
              {when(g.at)} · {SOURCE_LABEL[g.source] ?? g.source} · {coinCount(g.coins)} {g.coins === 1 ? "coin" : "coins"} worth {naira(g.amountKobo)}
            </small>
          </span>
          <span className="coin-activity-amount" data-dir="in">+{naira(g.shareKobo)}</span>
        </li>
      ))}
    </ul>
  );
}

function WithdrawalHistory({ withdrawals }: { withdrawals: Withdrawal[] }) {
  if (!withdrawals.length) return <Empty icon={<History className="h-6 w-6" />} text="Your withdrawals will show here." />;
  return (
    <ul className="coin-activity mt-4">
      {withdrawals.map((w) => (
        <li key={w.id}>
          <span className="coin-activity-icon" data-dir="out"><ArrowUpRight className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <strong>{naira(w.payoutKobo)} to {w.accountName || w.bankName}</strong>
            <small>
              {w.source === "earnings"
                ? `${naira(w.grossKobo)} less ${naira(w.feeKobo)} fee`
                : `${coinCount(w.coins)} coins`}
              {" · "}{w.bankName} {masked(w.accountNumber)} · {when(w.at)}
              {w.adminNote ? ` · ${w.adminNote}` : ""}
            </small>
          </span>
          <span className="coin-status" data-status={w.status}>{STATUS_LABEL[w.status]}</span>
        </li>
      ))}
    </ul>
  );
}

function WithdrawPanel({ data, reload, onManageAccounts }: { data: EscortData; reload: () => Promise<void>; onManageAccounts: () => void }) {
  const accounts = data.accounts;
  const [accountId, setAccountId] = useState(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<WithdrawQuote | null>(null);
  const [modalError, setModalError] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "");
  }, [accounts, accountId]);

  const open = data.withdrawals.find((w) => w.status === "REQUESTED" || w.status === "APPROVED");
  const account = accounts.find((a) => a.id === accountId);
  const grossKobo = Math.round(Number(amount || "0") * 100);
  const balance = data.earnings.balanceKobo;
  // Same rounding as the server, shown live as a preview. The server quote is final.
  const preview = useMemo(() => {
    const feeKobo = Math.round((grossKobo * data.feeBps) / 10_000);
    return { feeKobo, payoutKobo: grossKobo - feeKobo };
  }, [grossKobo, data.feeBps]);
  const tooHigh = grossKobo > balance;
  const blocked = !data.eligibility.paid || data.eligibility.payoutsFrozen;
  const canSubmit = !blocked && !open && !!account && grossKobo > 0 && !tooHigh && preview.payoutKobo > 0 && !quoting;
  const feePct = (data.feeBps / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 });

  async function review(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setDone("");
    setQuoting(true);
    const response = await fetch("/api/coins/withdraw/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountKobo: grossKobo }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setQuoting(false);
    if (!response?.ok) {
      setError(body.error ?? "Could not prepare your withdrawal. Try again.");
      return;
    }
    setModalError("");
    setModalNotice("");
    setQuote({ grossKobo: body.grossKobo, feeKobo: body.feeKobo, payoutKobo: body.payoutKobo, feeBps: body.feeBps });
  }

  async function confirm() {
    if (!quote || !account) return;
    setBusy(true);
    setModalError("");
    setModalNotice("");
    const response = await fetch("/api/coins/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountKobo: quote.grossKobo,
        accountId: account.id,
        expectedFeeKobo: quote.feeKobo,
        expectedPayoutKobo: quote.payoutKobo,
      }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (response?.status === 409 && body.quote && typeof body.quote.payoutKobo === "number") {
      setQuote({ grossKobo: body.quote.grossKobo, feeKobo: body.quote.feeKobo, payoutKobo: body.quote.payoutKobo, feeBps: body.quote.feeBps });
      setModalNotice("The fee was just updated. Check the new figures and confirm again.");
      return;
    }
    if (!response?.ok) {
      setModalError(body.error ?? "The withdrawal could not be requested. Try again.");
      return;
    }
    setQuote(null);
    setAmount("");
    setDone(
      data.manualApproval
        ? `Withdrawal requested. ${naira(body.payoutKobo)} will be sent to ${body.accountName || account.accountName} once it is approved.`
        : `Withdrawal requested. ${naira(body.payoutKobo)} is on its way to ${body.accountName || account.accountName}.`
    );
    await reload();
  }

  return (
    <section className="coin-withdraw mt-5">
      <h2 className="font-display flex items-center gap-2 text-lg font-bold"><Banknote className="h-5 w-5 text-[#df3a6a]" /> Withdraw earnings</h2>
      <p className="mt-1 text-sm text-muted">
        Withdraw any amount from your available earnings. A {feePct}% fee applies and there is no minimum. You will see the exact amount before you confirm.
      </p>

      {done ? <p className="coin-flash mt-4" data-tone="good"><CheckCircle2 className="h-4 w-4" /> {done}</p> : null}

      {open ? (
        <p className="coin-flash mt-4" data-tone="info">
          <Loader2 className="h-4 w-4 animate-spin" /> {naira(open.payoutKobo)} to {open.accountName} is being processed. You can request another withdrawal once it is done.
        </p>
      ) : !accounts.length ? (
        <div className="coin-empty mt-4">
          <Landmark className="h-6 w-6" />
          <p>Add a withdrawal account first. We confirm the account name with your bank.</p>
          <button type="button" className="btn-primary mt-2 text-xs" onClick={onManageAccounts}><Plus className="h-3.5 w-3.5" /> Add account</button>
        </div>
      ) : (
        <form onSubmit={review} className="mt-4 space-y-3">
          <label className="coin-field">
            <span>Send to</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName} · {a.bankName} {masked(a.accountNumber)}{a.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="coin-field">
            <span>Amount (₦)</span>
            <input
              inputMode="decimal"
              value={amount}
              placeholder="0"
              aria-invalid={tooHigh}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                if (/^\d*(\.\d{0,2})?$/.test(v)) setAmount(v);
              }}
            />
          </label>
          <div className="coin-amount-row">
            <button type="button" className="section-link text-xs" onClick={() => setAmount(balance ? String(balance / 100) : "")} disabled={!balance}>
              Withdraw all ({naira(balance)})
            </button>
          </div>
          <dl className="coin-breakdown" aria-live="polite">
            <div><dt>Withdrawal amount</dt><dd>{naira(grossKobo)}</dd></div>
            <div><dt>Fee ({feePct}%)</dt><dd>{preview.feeKobo ? `-${naira(preview.feeKobo)}` : naira(0)}</dd></div>
            <div data-total="true"><dt>Final amount</dt><dd>{naira(Math.max(preview.payoutKobo, 0))}</dd></div>
          </dl>
          {tooHigh ? <p className="coin-flash" data-tone="bad">That is more than your available earnings of {naira(balance)}.</p> : null}
          {error ? <p className="coin-flash" data-tone="bad">{error}</p> : null}
          <button type="submit" className="btn-primary w-full text-sm" disabled={!canSubmit}>
            {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Review withdrawal"}
          </button>
        </form>
      )}

      {quote && account ? (
        <WithdrawConfirmModal
          quote={quote}
          bankName={account.bankName}
          accountNumber={account.accountNumber}
          accountName={account.accountName}
          busy={busy}
          error={modalError}
          notice={modalNotice}
          onConfirm={() => void confirm()}
          onCancel={() => setQuote(null)}
        />
      ) : null}
    </section>
  );
}

function AccountsPanel({ initial, reload }: { initial: Account[]; reload: () => Promise<void> }) {
  const [accounts, setAccounts] = useState(initial);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankError, setBankError] = useState("");
  const [adding, setAdding] = useState(initial.length === 0);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setAccounts(initial), [initial]);

  useEffect(() => {
    if (!adding || banks.length) return;
    fetch("/api/coins/banks")
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setBanks(b.banks ?? []) : setBankError(b.error ?? "Could not load banks.")))
      .catch(() => setBankError("Could not load banks."));
  }, [adding, banks.length]);

  // Look up the account name as soon as a full account number and bank are set.
  useEffect(() => {
    setAccountName("");
    setResolveError("");
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setResolving(true);
      const response = await fetch("/api/coins/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      }).catch(() => null);
      const body = response ? await response.json().catch(() => ({})) : {};
      if (cancelled) return;
      setResolving(false);
      if (response?.ok && body.accountName) setAccountName(body.accountName);
      else setResolveError(body.error ?? "We could not find that account.");
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accountNumber, bankCode]);

  async function call(method: "POST" | "PATCH" | "DELETE", payload: object) {
    const response = await fetch("/api/coins/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    return { ok: !!response?.ok, body };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!accountName || saving) return;
    setSaving(true);
    setError("");
    const { ok, body } = await call("POST", { bankCode, accountNumber });
    setSaving(false);
    if (!ok) return setError(body.error ?? "Could not save that account.");
    setBankCode("");
    setAccountNumber("");
    setAdding(false);
    await reload();
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    setError("");
    const { ok, body } = await call("PATCH", { accountId: id });
    setBusyId("");
    if (!ok) return setError(body.error ?? "Could not update that account.");
    setAccounts(body.accounts);
    await reload();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this withdrawal account?")) return;
    setBusyId(id);
    setError("");
    const { ok, body } = await call("DELETE", { accountId: id });
    setBusyId("");
    if (!ok) return setError(body.error ?? "Could not remove that account.");
    setAccounts(body.accounts);
    await reload();
  }

  return (
    <section className="coin-withdraw mt-5">
      <h2 className="font-display flex items-center gap-2 text-lg font-bold"><Landmark className="h-5 w-5 text-[#df3a6a]" /> Withdrawal accounts</h2>
      <p className="mt-1 text-sm text-muted">Save up to 5 Nigerian bank accounts. The account name is confirmed with the bank so money only goes to the right person.</p>

      {error ? <p className="coin-flash mt-3" data-tone="bad">{error}</p> : null}

      {accounts.length ? (
        <ul className="coin-accounts mt-4">
          {accounts.map((a) => (
            <li key={a.id} data-default={a.isDefault}>
              <Landmark className="h-4 w-4 shrink-0 text-[#ef789a]" />
              <span className="min-w-0 flex-1">
                <strong>{a.accountName}</strong>
                <small>{a.bankName} · {a.accountNumber}</small>
              </span>
              {a.isDefault ? (
                <span className="coin-status" data-status="PAID">Default</span>
              ) : (
                <button type="button" className="section-link text-xs" disabled={!!busyId} onClick={() => void makeDefault(a.id)}>
                  {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Make default"}
                </button>
              )}
              <button type="button" className="coin-icon-button" aria-label={`Remove ${a.bankName} account`} disabled={!!busyId} onClick={() => void remove(a.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="coin-field">
            <span>Bank name</span>
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
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 text-sm" disabled={!accountName || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save account"}
            </button>
            {accounts.length ? (
              <button type="button" className="btn-ghost text-sm" onClick={() => setAdding(false)}>Cancel</button>
            ) : null}
          </div>
        </form>
      ) : accounts.length < 5 ? (
        <button type="button" className="btn-ghost mt-4 w-full text-sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add another account
        </button>
      ) : null}
    </section>
  );
}

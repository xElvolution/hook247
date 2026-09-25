import Link from "next/link";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { getCoinSettings } from "@/lib/coins";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { payoutMarkPaid, payoutReject, payoutViaPaystack } from "../coins/actions";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand";

export default async function CoinPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "open";
  const [settings, rows] = await Promise.all([
    getCoinSettings(),
    db.coinWithdrawal.findMany({
      where: status === "open" ? { status: { in: ["REQUESTED", "APPROVED"] } } : status === "all" ? {} : { status: status as "PAID" | "REJECTED" },
      include: { user: { select: { email: true, profile: { select: { displayName: true } }, coinWallet: true } } },
      orderBy: { createdAt: status === "open" ? "asc" : "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Coin payouts</h1>
        <p className="mt-1 text-sm text-muted">
          Escort withdrawals. Rate {nairaFromKobo(settings.payoutKoboPerCoin)} per coin, minimum {settings.minWithdrawalCoins} coins.{" "}
          Paystack transfers are {settings.paystackTransfersEnabled ? "on" : "off"} (<Link href="/502test/coins" className="underline">settings</Link>).
        </p>
      </div>
      {params.error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{params.error}</p> : null}
      {params.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{params.ok}</p> : null}

      <div className="flex flex-wrap gap-2">
        {[
          ["open", "Open"],
          ["PAID", "Paid"],
          ["REJECTED", "Rejected"],
          ["all", "All"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/502test/coin-payouts?status=${key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === key ? "bg-brand text-white" : "border border-line text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Panel title="Requests">
        {rows.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <div className="space-y-3">
            {rows.map((w) => (
              <div key={w.id} className="rounded-lg border border-line/70 bg-surface/50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{w.user.profile?.displayName ?? w.user.email}</strong>
                  <span className="text-muted">{w.user.email}</span>
                  <Badge tone={w.status === "PAID" ? "good" : w.status === "REJECTED" ? "muted" : "warn"}>{w.status}</Badge>
                  <span className="text-xs text-muted">{w.createdAt.toLocaleString("en-NG")}</span>
                </div>
                <p className="mt-1.5">
                  <strong>{nairaFromKobo(w.amountKobo)}</strong> for {w.coins.toLocaleString("en-NG")} coins to{" "}
                  <strong>{w.accountName}</strong> · {w.accountNumber} · {w.bankName}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Wallet now: {(w.user.coinWallet?.balance ?? 0).toLocaleString("en-NG")} spendable, {(w.user.coinWallet?.held ?? 0).toLocaleString("en-NG")} held ·{" "}
                  <Link href={`/502test/coins?user=${w.userId}`} className="underline">ledger</Link>
                  {w.payoutReference ? ` · ref ${w.payoutReference}` : ""}
                  {w.adminNote ? ` · ${w.adminNote}` : ""}
                </p>
                {w.status === "REQUESTED" || w.status === "APPROVED" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={payoutMarkPaid} className="flex flex-wrap gap-1.5">
                      <input type="hidden" name="id" value={w.id} />
                      <input name="reference" placeholder="Bank transfer reference" className={`${input} w-48`} />
                      <input name="note" placeholder="Note (optional)" className={`${input} w-36`} />
                      <button type="submit" className="rounded border border-good/40 px-2.5 py-1 text-xs font-semibold text-good">Mark paid</button>
                    </form>
                    <form action={payoutReject} className="flex gap-1.5">
                      <input type="hidden" name="id" value={w.id} />
                      <input name="note" placeholder="Reason" className={`${input} w-40`} />
                      <button type="submit" className="rounded border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-300">Reject + refund</button>
                    </form>
                    {settings.paystackTransfersEnabled && w.status === "REQUESTED" ? (
                      <form action={payoutViaPaystack}>
                        <input type="hidden" name="id" value={w.id} />
                        <button type="submit" className="rounded border border-brand/50 px-2.5 py-1 text-xs font-semibold text-brand-2">Pay via Paystack</button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

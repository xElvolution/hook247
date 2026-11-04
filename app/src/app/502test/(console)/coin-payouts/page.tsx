import Link from "next/link";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { getCoinSettings } from "@/lib/coins";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { isKorapayPayoutReference } from "@/lib/coinPayouts";
import { getBalances } from "@/lib/korapay";
import { payoutApprove, payoutCheckStatus, payoutMarkPaid, payoutReject, payoutViaKorapay } from "../coins/actions";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand";

export default async function CoinPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "open";
  const [settings, rows, korapayBalance] = await Promise.all([
    getCoinSettings(),
    db.coinWithdrawal.findMany({
      where: status === "open" ? { status: { in: ["REQUESTED", "APPROVED"] } } : status === "all" ? {} : { status: status as "PAID" | "REJECTED" },
      include: {
        user: { select: { email: true, payoutsFrozen: true, profile: { select: { displayName: true } }, coinWallet: true, earningsWallet: true } },
      },
      orderBy: { createdAt: status === "open" ? "asc" : "desc" },
      take: 100,
    }),
    getBalances()
      .then((b) => b.NGN ?? null)
      .catch((err) => {
        console.error("Korapay balance lookup failed:", (err as Error).message);
        return null;
      }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Earnings payouts</h1>
        <p className="mt-1 text-sm text-muted">
          Escort withdrawals from their Earnings Wallet. Fee {settings.withdrawalFeeBps / 100}%, no minimum. Manual approval is{" "}
          {settings.manualWithdrawalApproval ? "on" : "off"} and Korapay payouts are {settings.bankTransfersEnabled ? "on" : "off"}{" "}
          (<Link href="/502test/coins" className="underline">settings</Link>).
        </p>
        <p className="mt-1 text-xs text-muted">
          {korapayBalance
            ? `Korapay NGN balance: ${nairaFromKobo(korapayBalance.availableKobo)} available, ${nairaFromKobo(korapayBalance.pendingKobo)} pending.`
            : "Korapay balance unavailable right now."}
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
                  {w.source !== "earnings" ? <Badge>legacy coins</Badge> : null}
                  {w.user.payoutsFrozen ? <Badge tone="bad">payouts frozen</Badge> : null}
                  <span className="text-xs text-muted">{w.createdAt.toLocaleString("en-NG")}</span>
                </div>
                <p className="mt-1.5">
                  {w.source === "earnings" ? (
                    <>
                      Send <strong>{nairaFromKobo(w.amountKobo)}</strong> ({nairaFromKobo(w.grossKobo)} less {nairaFromKobo(w.feeKobo)} fee) to{" "}
                    </>
                  ) : (
                    <>
                      Send <strong>{nairaFromKobo(w.amountKobo)}</strong> for {w.coins.toLocaleString("en-NG")} coins to{" "}
                    </>
                  )}
                  <strong>{w.accountName}</strong> · {w.accountNumber} · {w.bankName}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {w.source === "earnings"
                    ? `Earnings now: ${nairaFromKobo(w.user.earningsWallet?.balanceKobo ?? 0)} available, ${nairaFromKobo(w.user.earningsWallet?.heldKobo ?? 0)} held`
                    : `Wallet now: ${(w.user.coinWallet?.balance ?? 0).toLocaleString("en-NG")} coins spendable, ${(w.user.coinWallet?.held ?? 0).toLocaleString("en-NG")} held`}
                  {w.approvedAt ? ` · approved ${w.approvedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}` : ""} ·{" "}
                  <Link href={`/502test/transactions?user=${w.userId}`} className="underline">transactions</Link>
                  {w.payoutReference ? ` · ref ${w.payoutReference}` : ""}
                  {w.adminNote ? ` · ${w.adminNote}` : ""}
                </p>
                {(w.status === "REQUESTED" || w.status === "APPROVED") && isKorapayPayoutReference(w.payoutReference) ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="warn">Korapay payout in flight</Badge>
                    <form action={payoutCheckStatus}>
                      <input type="hidden" name="id" value={w.id} />
                      <button type="submit" className="rounded border border-brand/50 px-2.5 py-1 text-xs font-semibold text-brand-2">Check Korapay status</button>
                    </form>
                  </div>
                ) : w.status === "REQUESTED" || w.status === "APPROVED" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {w.status === "REQUESTED" && w.source === "earnings" ? (
                      <form action={payoutApprove} className="flex gap-1.5">
                        <input type="hidden" name="id" value={w.id} />
                        <button type="submit" className="rounded border border-amber-400/50 px-2.5 py-1 text-xs font-semibold text-amber-300">Approve</button>
                      </form>
                    ) : null}
                    <form action={payoutMarkPaid} className="flex flex-wrap gap-1.5">
                      <input type="hidden" name="id" value={w.id} />
                      <input name="reference" placeholder="Bank transfer reference" className={`${input} w-48`} />
                      <input name="note" placeholder="Note (optional)" className={`${input} w-36`} />
                      <button type="submit" className="rounded border border-good/40 px-2.5 py-1 text-xs font-semibold text-good">Mark paid</button>
                    </form>
                    <form action={payoutReject} className="flex gap-1.5">
                      <input type="hidden" name="id" value={w.id} />
                      <input name="note" placeholder="Reason" className={`${input} w-40`} />
                      <button type="submit" className="rounded border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-300">Reject and refund</button>
                    </form>
                    {settings.bankTransfersEnabled && !w.payoutReference ? (
                      <form action={payoutViaKorapay}>
                        <input type="hidden" name="id" value={w.id} />
                        <button type="submit" className="rounded border border-brand/50 px-2.5 py-1 text-xs font-semibold text-brand-2">Pay via Korapay</button>
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

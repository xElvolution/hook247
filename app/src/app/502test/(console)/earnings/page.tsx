import Link from "next/link";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { hasActivePaidPlan } from "@/lib/eligibility";
import { Panel, Badge, Empty, Stat } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

export default async function EarningsAdminPage() {
  const [wallets, totals, paid] = await Promise.all([
    db.earningsWallet.findMany({
      orderBy: [{ balanceKobo: "desc" }, { lifetimeKobo: "desc" }],
      take: 200,
      include: {
        user: {
          select: {
            email: true,
            payoutsFrozen: true,
            giftingDisabled: true,
            profile: { select: { displayName: true, plan: true, subscriptionExpiresAt: true } },
          },
        },
      },
    }),
    db.earningsWallet.aggregate({ _sum: { balanceKobo: true, heldKobo: true, lifetimeKobo: true }, _count: true }),
    db.coinWithdrawal.aggregate({ where: { source: "earnings", status: "PAID" }, _sum: { amountKobo: true, feeKobo: true } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Escort earnings</h1>
        <p className="mt-1 text-sm text-muted">Earnings Wallets in naira. Balances only change through the transaction ledger.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Available" value={nairaFromKobo(totals._sum.balanceKobo ?? 0)} sub={`${totals._count} wallets`} />
        <Stat label="Held for payouts" value={nairaFromKobo(totals._sum.heldKobo ?? 0)} tone="warn" href="/502test/coin-payouts" />
        <Stat label="Earned all time" value={nairaFromKobo(totals._sum.lifetimeKobo ?? 0)} tone="good" />
        <Stat label="Paid out" value={nairaFromKobo(paid._sum.amountKobo ?? 0)} sub={`${nairaFromKobo(paid._sum.feeKobo ?? 0)} in fees`} tone="brand" />
      </div>
      <Panel title="Wallets">
        {wallets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="uppercase text-muted">
                <tr><th className="py-1.5">Escort</th><th>Available</th><th>Held</th><th>Lifetime</th><th>Plan</th><th>Flags</th><th></th></tr>
              </thead>
              <tbody>
                {wallets.map((w) => {
                  const paidPlan = w.user.profile ? hasActivePaidPlan(w.user.profile) : false;
                  return (
                    <tr key={w.userId} className="border-t border-line">
                      <td className="py-1.5">
                        <Link href={`/502test/users/${w.userId}`} className="underline">{w.user.profile?.displayName ?? w.user.email}</Link>
                        <span className="block text-muted">{w.user.email}</span>
                      </td>
                      <td>{nairaFromKobo(w.balanceKobo)}</td>
                      <td>{nairaFromKobo(w.heldKobo)}</td>
                      <td>{nairaFromKobo(w.lifetimeKobo)}</td>
                      <td>{paidPlan ? <Badge tone="good">{w.user.profile?.plan}</Badge> : <Badge>no active plan</Badge>}</td>
                      <td className="space-x-1">
                        {w.user.payoutsFrozen ? <Badge tone="bad">payouts frozen</Badge> : null}
                        {w.user.giftingDisabled ? <Badge tone="bad">gifting off</Badge> : null}
                      </td>
                      <td><Link href={`/502test/transactions?user=${w.userId}&kind=all`} className="underline">transactions</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No escort has earned from gifts yet.</Empty>
        )}
      </Panel>
    </div>
  );
}

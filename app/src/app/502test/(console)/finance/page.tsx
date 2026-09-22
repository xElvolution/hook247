import { db } from "@/lib/db";
import { nairaFromKobo, settleCommissions } from "@/lib/money";
import { Panel, Stat } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await settleCommissions();
  const [subs, boosts, commissions, pending, withdrawn, pendingWd] = await Promise.all([
    db.payment.aggregate({
      where: { status: "SUCCESS", purpose: { in: ["SUBSCRIPTION", "PLAN_PLUS", "PLAN_ELITE"] } },
      _sum: { amountKobo: true },
    }),
    db.payment.aggregate({
      where: { status: "SUCCESS", purpose: "BOOST" },
      _sum: { amountKobo: true },
    }),
    db.referralEarning.aggregate({
      where: { status: { not: "VOID" } },
      _sum: { amountKobo: true },
    }),
    db.referralEarning.aggregate({
      where: { status: "PENDING" },
      _sum: { amountKobo: true },
    }),
    db.withdrawal.aggregate({
      where: { status: "PAID" },
      _sum: { amountKobo: true },
    }),
    db.withdrawal.aggregate({
      where: { status: { in: ["REQUESTED", "APPROVED"] } },
      _sum: { amountKobo: true },
    }),
  ]);

  const subKobo = subs._sum.amountKobo ?? 0;
  const boostKobo = boosts._sum.amountKobo ?? 0;
  const commKobo = commissions._sum.amountKobo ?? 0;
  const net = subKobo + boostKobo - commKobo;

  const byPlan = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Finance</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Subscription revenue" value={nairaFromKobo(subKobo)} />
        <Stat label="Boost revenue" value={nairaFromKobo(boostKobo)} />
        <Stat label="Referral commissions" value={nairaFromKobo(commKobo)} />
        <Stat label="Net" value={nairaFromKobo(net)} tone="good" />
        <Stat label="Pending commissions" value={nairaFromKobo(pending._sum.amountKobo ?? 0)} tone="warn" />
        <Stat label="Withdrawn" value={nairaFromKobo(withdrawn._sum.amountKobo ?? 0)} />
        <Stat label="Pending withdrawals" value={nairaFromKobo(pendingWd._sum.amountKobo ?? 0)} tone="warn" />
      </div>
      <Panel title="Plans on file">
        <ul className="mt-3 space-y-1 text-sm">
          {byPlan.map((plan) => (
            <li key={plan.id}>
              {plan.name}: {nairaFromKobo(plan.priceKobo)} · {plan.durationDays}d · {plan.publicVisible ? "public" : "hidden"}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

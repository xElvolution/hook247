import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { uniqueReferralCode } from "@/lib/referrals";
import {
  availableCommissionKobo,
  ensureCatalog,
  nairaFromKobo,
  pendingCommissionKobo,
  settleCommissions,
} from "@/lib/money";

export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await ensureCatalog();
  await settleCommissions();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.referralCode) {
    await db.user.update({
      where: { id: userId },
      data: { referralCode: await uniqueReferralCode() },
    });
  }

  const refreshed = await db.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
      _count: { select: { referrals: true } },
    },
  });

  const referredIds = (
    await db.user.findMany({
      where: { referredById: userId },
      select: { id: true },
    })
  ).map((row) => row.id);

  const paying = referredIds.length
    ? await db.payment.groupBy({
        by: ["userId"],
        where: {
          userId: { in: referredIds },
          status: "SUCCESS",
          purpose: { in: ["SUBSCRIPTION", "PLAN_PLUS", "PLAN_ELITE"] },
        },
      })
    : [];

  const [pending, available, earned, withdrawn, history] = await Promise.all([
    pendingCommissionKobo(userId),
    availableCommissionKobo(userId),
    db.referralEarning.aggregate({
      where: { referrerId: userId, status: { not: "VOID" } },
      _sum: { amountKobo: true },
    }),
    db.withdrawal.aggregate({
      where: { userId, status: "PAID" },
      _sum: { amountKobo: true },
    }),
    db.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.hooks247.com").replace(/\/$/, "");
  const code = refreshed?.referralCode ?? "";

  return NextResponse.json({
    ok: true,
    referral: {
      code,
      link: `${appUrl}/signup?ref=${code}`,
      totalReferrals: refreshed?._count.referrals ?? 0,
      payingReferrals: paying.length,
      pendingKobo: pending,
      availableKobo: available,
      earnedKobo: earned._sum.amountKobo ?? 0,
      withdrawnKobo: withdrawn._sum.amountKobo ?? 0,
      pendingLabel: nairaFromKobo(pending),
      availableLabel: nairaFromKobo(available),
      earnedLabel: nairaFromKobo(earned._sum.amountKobo ?? 0),
      withdrawnLabel: nairaFromKobo(withdrawn._sum.amountKobo ?? 0),
      history: history.map((row) => ({
        id: row.id,
        planName: row.planName,
        paymentNumber: row.paymentNumber,
        percent: row.percent,
        sourceKobo: row.sourceKobo,
        amountKobo: row.amountKobo,
        amountLabel: nairaFromKobo(row.amountKobo),
        status: row.status,
        transactionRef: row.transactionRef,
        createdAt: row.createdAt,
        availableAt: row.availableAt,
      })),
    },
  });
}

import { randomBytes } from "node:crypto";
import { db } from "./db";
import { getSettings } from "./money";

export async function uniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const exists = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function resolveReferrerId(code: string | null | undefined, selfId?: string) {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return null;
  const referrer = await db.user.findUnique({
    where: { referralCode: trimmed },
    select: { id: true },
  });
  if (!referrer) return null;
  if (selfId && referrer.id === selfId) return null;
  return referrer.id;
}

export async function creditReferralCommission(opts: {
  referredUserId: string;
  paymentId: string;
  sourceKobo: number;
  purpose: string;
  planName: string;
  transactionRef: string;
}) {
  if (opts.purpose !== "SUBSCRIPTION" && opts.purpose !== "PLAN_PLUS" && opts.purpose !== "PLAN_ELITE") {
    return;
  }
  if (opts.sourceKobo <= 0) return;

  const referred = await db.user.findUnique({
    where: { id: opts.referredUserId },
    select: { id: true, referredById: true, email: true },
  });
  if (!referred?.referredById) return;
  if (referred.referredById === referred.id) return;

  const settings = await getSettings();
  const prior = await db.payment.count({
    where: {
      userId: referred.id,
      status: "SUCCESS",
      purpose: { in: ["SUBSCRIPTION", "PLAN_PLUS", "PLAN_ELITE"] },
      id: { not: opts.paymentId },
    },
  });
  const paymentNumber = prior + 1;
  if (paymentNumber > settings.qualifyingPayments) return;

  const percent =
    paymentNumber === 1
      ? settings.commissionPct1
      : paymentNumber === 2
        ? settings.commissionPct2
        : settings.commissionPct3;
  if (percent <= 0) return;

  const amountKobo = Math.max(1, Math.round((opts.sourceKobo * percent) / 100));
  const availableAt = new Date(Date.now() + settings.holdHours * 60 * 60 * 1000);

  await db.referralEarning.upsert({
    where: { paymentId: opts.paymentId },
    create: {
      referrerId: referred.referredById,
      referredId: referred.id,
      paymentId: opts.paymentId,
      sourceKobo: opts.sourceKobo,
      amountKobo,
      percent,
      paymentNumber,
      planName: opts.planName,
      transactionRef: opts.transactionRef,
      status: "PENDING",
      availableAt,
    },
    update: {},
  });
}

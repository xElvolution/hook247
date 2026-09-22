import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import { sendReceiptEmail } from "@/lib/mailer";
import { creditReferralCommission } from "@/lib/referrals";

export type FulfilResult =
  | { ok: true; state: "fulfilled" | "already"; description?: string }
  | { ok: false; state: "unknown" | "failed"; error: string };

export async function fulfilPayment(reference: string): Promise<FulfilResult> {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) {
    return { ok: false, state: "unknown", error: "Unknown reference" };
  }
  if (payment.status === "SUCCESS") {
    return { ok: true, state: "already" };
  }
  if (payment.status === "FAILED" || payment.status === "ABANDONED") {
    return { ok: false, state: "failed", error: "Payment did not succeed" };
  }

  let verified: Awaited<ReturnType<typeof verifyTransaction>>;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    console.error("Paystack verify threw:", err);
    return { ok: false, state: "failed", error: "Could not verify with Paystack" };
  }
  if (!verified.success || verified.amountKobo !== payment.amountKobo) {
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, state: "failed", error: "Verification failed" };
  }

  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "SUCCESS", fulfilledAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: true, state: "already" };
  }

  const profile = await db.profile.findUnique({
    where: { userId: payment.userId },
    include: { user: true },
  });
  if (!profile) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", fulfilledAt: null },
    });
    return { ok: false, state: "failed", error: "Profile not found" };
  }

  let description = "Purchase";
  let planName = "";
  const now = new Date();

  if (payment.purpose === "SUBSCRIPTION" || payment.purpose === "PLAN_PLUS" || payment.purpose === "PLAN_ELITE") {
    let days = payment.purpose === "PLAN_ELITE" ? 90 : 30;
    let slug = payment.purpose === "PLAN_ELITE" ? "quarterly" : "monthly";
    let name = payment.purpose === "PLAN_ELITE" ? "3 Months" : "Monthly";
    if (payment.productId) {
      const plan = await db.subscriptionPlan.findUnique({ where: { id: payment.productId } });
      if (plan) {
        days = plan.durationDays;
        slug = plan.slug;
        name = plan.name;
      }
    }
    const base =
      profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > now
        ? profile.subscriptionExpiresAt
        : now;
    const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await db.profile.update({
      where: { userId: payment.userId },
      data: {
        plan: days >= 90 ? "ELITE" : "PLUS",
        subscriptionExpiresAt: expires,
        subscriptionPlanSlug: slug,
      },
    });
    description = name;
    planName = name;
  } else if (payment.purpose === "BOOST") {
    let hours = 168;
    let name = "7-Day Profile Boost";
    if (payment.productId) {
      const product = await db.boostProduct.findUnique({ where: { id: payment.productId } });
      if (product) {
        hours = product.durationHours;
        name = product.name;
      }
    }
    const current =
      profile.boostedUntil && profile.boostedUntil > now ? profile.boostedUntil : now;
    const until = new Date(current.getTime() + hours * 60 * 60 * 1000);
    await db.profile.update({
      where: { userId: payment.userId },
      data: { boostedAt: now, boostedUntil: until },
    });
    description = name;
  } else if (payment.purpose === "VERIFICATION") {
    await db.profile.update({
      where: { userId: payment.userId },
      data: {
        verified: true,
        verifiedSource: "PAID",
        verifiedAt: now,
      },
    });
    description = "Profile verification";
  }

  try {
    await creditReferralCommission({
      referredUserId: payment.userId,
      paymentId: payment.id,
      sourceKobo: payment.amountKobo,
      purpose: payment.purpose,
      planName,
      transactionRef: payment.reference,
    });
  } catch (err) {
    console.error("Referral commission failed:", err);
  }

  try {
    await sendReceiptEmail(
      profile.user.email,
      description,
      payment.amountKobo,
      payment.reference
    );
  } catch (err) {
    console.error("Failed to send receipt email:", err);
  }

  return { ok: true, state: "fulfilled", description };
}

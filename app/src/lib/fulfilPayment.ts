import { db } from "@/lib/db";
import { chargeSettlesExactly, isFailedChargeStatus, KorapayError, verifyCharge } from "@/lib/korapay";
import { sendReceiptEmail } from "@/lib/mailer";
import { creditReferralCommission } from "@/lib/referrals";

export type FulfilResult =
  | { ok: true; state: "fulfilled" | "already"; description?: string }
  | { ok: false; state: "unknown" | "failed" | "pending"; error: string };

/**
 * Grant a plan, boost or verification once Korapay confirms the charge.
 * Idempotent: the row is claimed atomically, so the redirect, the webhook and
 * the admin retry can all run at once and the benefit is granted exactly once.
 */
export async function fulfilPayment(reference: string): Promise<FulfilResult> {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) {
    return { ok: false, state: "unknown", error: "Unknown reference" };
  }
  if (payment.status === "SUCCESS") {
    return { ok: true, state: "already" };
  }

  // FAILED rows are re-checked too: a declined first attempt can still be
  // paid on the same Korapay checkout, and Korapay is the source of truth.
  let charge: Awaited<ReturnType<typeof verifyCharge>>;
  try {
    charge = await verifyCharge(reference);
  } catch (err) {
    if (err instanceof KorapayError && err.status === 404) {
      return { ok: false, state: "pending", error: "Korapay has no record of this payment yet" };
    }
    console.error("Korapay verify failed:", (err as Error).message);
    return { ok: false, state: "pending", error: "Could not verify with Korapay yet" };
  }

  if (isFailedChargeStatus(charge.status)) {
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, state: "failed", error: "Payment did not succeed" };
  }
  if (charge.status !== "success") {
    // Still processing (e.g. a bank transfer on its way, or the buyer closed
    // the checkout). Leave the row open for the webhook.
    return { ok: false, state: "pending", error: "Payment not completed yet" };
  }
  const check = chargeSettlesExactly(charge, reference, payment.amountKobo);
  if (!check.ok) {
    console.error(`Payment ${reference} not fulfilled: ${check.reason}`);
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, state: "failed", error: `Verification failed (${check.reason})` };
  }

  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
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

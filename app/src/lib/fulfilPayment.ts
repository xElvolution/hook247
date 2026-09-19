import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import { sendReceiptEmail } from "@/lib/mailer";

/**
 * Fulfilment is shared by two callers that can race each other: the Paystack
 * webhook and the browser landing back on /premium after checkout. Whichever
 * arrives first wins; the other becomes a no-op. That matters because the
 * webhook needs a publicly reachable URL, so during local development the
 * callback is often the only path that runs.
 */

export type FulfilResult =
  | { ok: true; state: "fulfilled" | "already" ; description?: string }
  | { ok: false; state: "unknown" | "failed"; error: string };

const DESCRIPTIONS = {
  PLAN_PLUS: "Plus plan",
  PLAN_ELITE: "Elite plan",
  BOOST: "Profile Boost (1 hour)",
  VERIFICATION: "Profile verification",
} as const;

export async function fulfilPayment(reference: string): Promise<FulfilResult> {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment) {
    return { ok: false, state: "unknown", error: "Unknown reference" };
  }
  if (payment.status === "SUCCESS") {
    return { ok: true, state: "already" };
  }

  // Confirm with Paystack before granting anything. The amount must match what
  // we asked for, so a tampered callback cannot buy Elite at Boost prices.
  const verified = await verifyTransaction(reference);
  if (!verified.success || verified.amountKobo !== payment.amountKobo) {
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, state: "failed", error: "Verification failed" };
  }

  // Atomically claim the row: only the caller that flips PENDING -> SUCCESS
  // applies the benefit, so a webhook/callback race cannot double-grant.
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

  const { purpose } = payment;
  if (purpose === "PLAN_PLUS") {
    await db.profile.update({ where: { userId: payment.userId }, data: { plan: "PLUS" } });
  } else if (purpose === "PLAN_ELITE") {
    await db.profile.update({ where: { userId: payment.userId }, data: { plan: "ELITE" } });
  } else if (purpose === "BOOST") {
    await db.profile.update({
      where: { userId: payment.userId },
      data: { boostedAt: new Date() },
    });
  } else if (purpose === "VERIFICATION") {
    // Paying sets the badge but records that no human checked an ID, so the
    // admin review queue can still find and confirm it.
    await db.profile.update({
      where: { userId: payment.userId },
      data: {
        verified: true,
        verifiedSource: "PAID",
        verifiedAt: new Date(),
      },
    });
  }

  const description = DESCRIPTIONS[purpose];

  try {
    await sendReceiptEmail(
      profile.user.email,
      description,
      payment.amountKobo,
      payment.reference
    );
  } catch (err) {
    // The purchase is already active; a mail outage must not undo it.
    console.error("Failed to send receipt email:", err);
  }

  return { ok: true, state: "fulfilled", description };
}

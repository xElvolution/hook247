import { db } from "./db";
import { chargeSettlesExactly, isFailedChargeStatus, KorapayError, verifyCharge } from "./korapay";
import { creditPurchase, CoinError } from "./coins";

export const COIN_REFERENCE_PREFIX = "h247coins_";

export function isCoinReference(reference: string) {
  return reference.startsWith(COIN_REFERENCE_PREFIX);
}

export type CoinFulfilResult =
  | { ok: true; state: "credited" | "already"; coins: number }
  | { ok: false; state: "pending" | "failed" | "unknown"; error: string };

/**
 * Confirm a coin checkout with Korapay and credit the coins. Korapay is the
 * source of truth for whether money moved; our row only says what was bought.
 * Safe to call from the redirect, the webhook and the admin recheck at once:
 * creditPurchase claims the row and credits inside one transaction.
 */
export async function fulfilCoinPurchase(reference: string): Promise<CoinFulfilResult> {
  const purchase = await db.coinPurchase.findUnique({ where: { reference } });
  if (!purchase) return { ok: false, state: "unknown", error: "Unknown reference" };
  if (purchase.status === "SUCCESS") return { ok: true, state: "already", coins: purchase.coins };

  let charge: Awaited<ReturnType<typeof verifyCharge>>;
  try {
    charge = await verifyCharge(reference);
  } catch (err) {
    if (err instanceof KorapayError && err.status === 404) {
      return { ok: false, state: "pending", error: "Korapay has no record of this payment yet" };
    }
    console.error("Coin purchase verify failed:", (err as Error).message);
    return { ok: false, state: "pending", error: "Could not confirm the payment with Korapay yet" };
  }

  if (charge.status === "success") {
    const check = chargeSettlesExactly(charge, reference, purchase.amountKobo);
    if (!check.ok) {
      console.error(`Coin purchase ${reference} not credited: ${check.reason}`);
      await db.coinPurchase.updateMany({ where: { id: purchase.id, status: "PENDING" }, data: { status: "FAILED" } });
      return { ok: false, state: "failed", error: `Payment could not be matched (${check.reason})` };
    }
    try {
      const result = await creditPurchase(reference, charge.amountKobo as number);
      return { ok: true, state: result.credited ? "credited" : "already", coins: result.coins };
    } catch (err) {
      if (err instanceof CoinError) return { ok: false, state: "failed", error: err.message };
      throw err;
    }
  }

  if (isFailedChargeStatus(charge.status)) {
    await db.coinPurchase.updateMany({ where: { id: purchase.id, status: "PENDING" }, data: { status: "FAILED" } });
    return { ok: false, state: "failed", error: "The payment did not go through" };
  }

  // pending / processing: Korapay redirects back even when the buyer closed
  // the page or a bank transfer is still on its way, so the row stays open
  // and the charge.success webhook (or a recheck) credits it later.
  return { ok: false, state: "pending", error: "Payment not completed yet" };
}

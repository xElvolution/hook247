import { db } from "./db";
import { verifyTransactionStatus } from "./paystack";
import { creditPurchase, CoinError } from "./coins";

export const COIN_REFERENCE_PREFIX = "h247coins_";

export function isCoinReference(reference: string) {
  return reference.startsWith(COIN_REFERENCE_PREFIX);
}

export type CoinFulfilResult =
  | { ok: true; state: "credited" | "already"; coins: number }
  | { ok: false; state: "pending" | "failed" | "unknown"; error: string };

/**
 * Confirm a coin checkout with Paystack and credit the coins. Paystack is the
 * source of truth for whether money moved; our row only says what was bought.
 */
export async function fulfilCoinPurchase(reference: string): Promise<CoinFulfilResult> {
  const purchase = await db.coinPurchase.findUnique({ where: { reference } });
  if (!purchase) return { ok: false, state: "unknown", error: "Unknown reference" };
  if (purchase.status === "SUCCESS") return { ok: true, state: "already", coins: purchase.coins };

  let verified: Awaited<ReturnType<typeof verifyTransactionStatus>>;
  try {
    verified = await verifyTransactionStatus(reference);
  } catch (err) {
    console.error("Coin purchase verify failed:", err);
    return { ok: false, state: "pending", error: "Could not confirm the payment with Paystack yet" };
  }

  if (verified.status === "success") {
    if (verified.currency && verified.currency !== "NGN") {
      await db.coinPurchase.updateMany({ where: { id: purchase.id, status: "PENDING" }, data: { status: "FAILED" } });
      return { ok: false, state: "failed", error: "Unexpected currency" };
    }
    try {
      const result = await creditPurchase(reference, verified.amountKobo);
      return { ok: true, state: result.credited ? "credited" : "already", coins: result.coins };
    } catch (err) {
      if (err instanceof CoinError) return { ok: false, state: "failed", error: err.message };
      throw err;
    }
  }

  if (verified.status === "failed" || verified.status === "reversed") {
    await db.coinPurchase.updateMany({ where: { id: purchase.id, status: "PENDING" }, data: { status: "FAILED" } });
    return { ok: false, state: "failed", error: "The payment did not go through" };
  }

  // abandoned / ongoing / pending: the buyer may still finish on Paystack, so
  // the row stays open and a later webhook can credit it.
  return { ok: false, state: "pending", error: "Payment not completed yet" };
}

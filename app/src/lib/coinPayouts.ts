import { randomBytes } from "node:crypto";
import { db } from "./db";
import { disburseToBank, getPayout, KORAPAY_CURRENCY, KorapayError, resolveBankAccount } from "./korapay";
import { CoinError, getCoinSettings } from "./coins";
import { markPayoutPaid, rejectPayout } from "./earnings";

/** Prefix of payout references sent to Korapay. */
export const PAYOUT_REFERENCE_PREFIX = "f247pay_";

/** A payout reported missing by Korapay is only released after this long. */
const RELEASE_AFTER_MS = 15 * 60 * 1000;

export function isKorapayPayoutReference(reference: string) {
  return reference.startsWith(PAYOUT_REFERENCE_PREFIX);
}

/**
 * One reference per attempt: `f247pay_<withdrawal id>_<ms base36><random>`.
 * The timestamp lets a stuck attempt be aged without a schema change.
 */
function newPayoutReference(withdrawalId: string) {
  const id = withdrawalId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
  const reference = `${PAYOUT_REFERENCE_PREFIX}${id}_${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  return reference.slice(0, 50);
}

function referenceAgeMs(reference: string) {
  const stamp = reference.split("_").pop() ?? "";
  const ms = parseInt(stamp.slice(0, -4), 36);
  return Number.isFinite(ms) ? Date.now() - ms : 0;
}

/** Bank names come back in different orders and cases; compare the words. */
function sameAccountName(a: string, b: string) {
  const words = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  return words(a) !== "" && words(a) === words(b);
}

export type PayoutState = "paid" | "refunded" | "processing" | "unconfirmed" | "released" | "needs-review" | "already";

/**
 * Pay a withdrawal through Korapay payouts. Used when an admin presses "Pay
 * via Korapay", or automatically when manual approval is off and Korapay
 * payouts are switched on in coin settings.
 *
 * A request is "in flight" while it carries a payout reference and is not yet
 * paid or rejected. The reference is claimed in the database BEFORE Korapay
 * is called, so two admins (or an admin and the automatic path) can never
 * send the same payout twice. It is only released when Korapay definitely
 * refused the request; anything ambiguous stays in flight until the webhook
 * or a status check settles it.
 */
export async function payWithdrawalViaKorapay(withdrawalId: string): Promise<{ state: PayoutState; reference: string }> {
  const settings = await getCoinSettings();
  if (!settings.bankTransfersEnabled) {
    throw new CoinError("Korapay payouts are switched off in coin settings", "NOT_ALLOWED");
  }
  const w = await db.coinWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { select: { payoutsFrozen: true, email: true } } },
  });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status !== "REQUESTED" && w.status !== "APPROVED") throw new CoinError("This withdrawal is already settled", "STATE");
  if (w.payoutReference) throw new CoinError("A payout for this withdrawal is already in progress", "STATE");
  if (w.user.payoutsFrozen) throw new CoinError("Payouts are frozen for this account", "NOT_ALLOWED");
  if (!Number.isInteger(w.amountKobo) || w.amountKobo <= 0) throw new CoinError("Nothing to pay out on this withdrawal", "STATE");

  // Confirm the destination still belongs to the name the escort saved
  // before any money moves. Bank codes from before the switch that Korapay
  // does not know fail here too, with nothing sent.
  try {
    const resolved = await resolveBankAccount(w.accountNumber, w.bankCode);
    if (!sameAccountName(resolved.accountName, w.accountName)) {
      throw new CoinError(
        `Korapay resolves this account to "${resolved.accountName}", not "${w.accountName}". Ask the escort to re-add the account, or pay by hand.`,
        "STATE"
      );
    }
  } catch (err) {
    if (err instanceof CoinError) throw err;
    if (err instanceof KorapayError && err.definitive) {
      throw new CoinError(`Korapay could not confirm the bank account (${err.message}). Ask the escort to re-add it, or pay by hand.`, "STATE");
    }
    throw new CoinError(`Korapay is unavailable right now (${(err as Error).message}). Nothing was sent; try again shortly.`, "STATE");
  }

  const reference = newPayoutReference(w.id);
  const claimed = await db.coinWithdrawal.updateMany({
    where: { id: w.id, status: { in: ["REQUESTED", "APPROVED"] }, payoutReference: "" },
    data: { status: "APPROVED", approvedAt: w.approvedAt ?? new Date(), payoutReference: reference },
  });
  if (!claimed.count) throw new CoinError("Someone else is already processing this", "STATE");

  let payout: Awaited<ReturnType<typeof disburseToBank>>;
  try {
    payout = await disburseToBank({
      reference,
      amountKobo: w.amountKobo,
      bankCode: w.bankCode,
      accountNumber: w.accountNumber,
      accountName: w.accountName,
      email: w.user.email,
      narration: "Flirta247 earnings payout",
    });
  } catch (err) {
    if (err instanceof KorapayError && err.definitive) {
      // Korapay refused it outright, so nothing was created: put the request
      // back so it can be retried (with a new reference) or paid by hand.
      await db.coinWithdrawal.updateMany({
        where: { id: w.id, status: "APPROVED", transferCode: "", payoutReference: reference },
        data: { payoutReference: "" },
      });
      throw new CoinError(`Korapay refused the payout: ${err.message}`, "STATE");
    }
    // Timeout, 5xx, network: the payout may exist. Keep it in flight and ask
    // Korapay what happened instead of guessing.
    console.error(`Korapay disburse ${reference} gave no clear answer:`, (err as Error).message);
    try {
      const looked = await getPayout(reference);
      await db.coinWithdrawal.updateMany({ where: { id: w.id, payoutReference: reference }, data: { transferCode: reference } });
      return { state: await applyPayoutStatus(w.id, reference, looked.status, looked.message), reference };
    } catch {
      return { state: "unconfirmed", reference };
    }
  }

  // Korapay accepted it. transferCode marks "Korapay has this payout".
  await db.coinWithdrawal.updateMany({ where: { id: w.id, payoutReference: reference }, data: { transferCode: payout.reference || reference } });
  if (payout.amountKobo !== null && payout.amountKobo !== w.amountKobo) {
    console.error(`Korapay payout ${reference} amount ${payout.amountKobo} differs from ${w.amountKobo} kobo; review.`);
  }
  return { state: await applyPayoutStatus(w.id, reference, payout.status, payout.message), reference };
}

/** Apply a Korapay payout status to the withdrawal. Idempotent. */
async function applyPayoutStatus(withdrawalId: string, reference: string, status: string, message: string): Promise<PayoutState> {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) return "needs-review";
  if (status === "success") {
    if (w.status === "PAID") return "already";
    if (w.status === "REJECTED") {
      console.error(`Korapay payout ${reference} succeeded but the withdrawal was already refunded; review manually.`);
      return "needs-review";
    }
    try {
      await markPayoutPaid(w.id, reference, "Paid by Korapay payout");
    } catch (err) {
      if (err instanceof CoinError && err.code === "STATE") return "already";
      throw err;
    }
    return "paid";
  }
  if (status === "failed" || status === "reversed") {
    if (w.status === "REJECTED") return "already";
    if (w.status === "PAID") {
      console.error(`Korapay payout ${reference} reported ${status} after it was marked paid; review manually.`);
      return "needs-review";
    }
    try {
      // The money did not leave: the held amount goes back to the escort.
      await rejectPayout(w.id, `Korapay payout failed${message ? `: ${message}` : ""}`.slice(0, 300));
    } catch (err) {
      if (err instanceof CoinError && err.code === "STATE") return "already";
      throw err;
    }
    return "refunded";
  }
  return "processing";
}

/**
 * Finish a payout when Korapay sends transfer.success / transfer.failed. The
 * event only triggers the work: the outcome is read back from Korapay's API,
 * so the decision never rests on the webhook body alone.
 */
export async function settleTransferEvent(event: string, reference: string): Promise<PayoutState | "unknown"> {
  const w = await db.coinWithdrawal.findFirst({ where: { payoutReference: reference } });
  if (!w) {
    console.warn(`Korapay ${event} for unknown payout reference ${reference}`);
    return "unknown";
  }
  const payout = await getPayout(reference); // throws -> webhook answers 500 and Korapay retries
  if (payout.currency && payout.currency !== KORAPAY_CURRENCY) {
    console.error(`Korapay payout ${reference} came back in ${payout.currency}; review manually.`);
    return "needs-review";
  }
  if (payout.amountKobo !== null && payout.amountKobo !== w.amountKobo) {
    console.error(`Korapay payout ${reference} amount ${payout.amountKobo} differs from ${w.amountKobo} kobo; review.`);
  }
  if (!w.transferCode) {
    await db.coinWithdrawal.updateMany({ where: { id: w.id, transferCode: "" }, data: { transferCode: reference } });
  }
  return applyPayoutStatus(w.id, reference, payout.status, payout.message);
}

/**
 * Admin "Check Korapay status": settles an in-flight payout from the status
 * lookup. If Korapay has no record of the reference, the attempt was never
 * created; once it is old enough to rule out a request still in transit the
 * reference is released so the payout can be retried.
 */
export async function syncPayoutStatus(withdrawalId: string): Promise<PayoutState> {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (!w.payoutReference || !isKorapayPayoutReference(w.payoutReference)) {
    throw new CoinError("This withdrawal has no Korapay payout to check", "STATE");
  }
  if (w.status === "PAID" || w.status === "REJECTED") return "already";
  const reference = w.payoutReference;
  try {
    const payout = await getPayout(reference);
    if (!w.transferCode) {
      await db.coinWithdrawal.updateMany({ where: { id: w.id, transferCode: "" }, data: { transferCode: reference } });
    }
    return applyPayoutStatus(w.id, reference, payout.status, payout.message);
  } catch (err) {
    if (err instanceof KorapayError && err.status === 404) {
      if (w.transferCode) {
        console.error(`Korapay accepted payout ${reference} but now has no record of it; review manually.`);
        return "needs-review";
      }
      if (referenceAgeMs(reference) < RELEASE_AFTER_MS) {
        throw new CoinError("Korapay has no record of this payout yet. Check again in 15 minutes before retrying.", "STATE");
      }
      const released = await db.coinWithdrawal.updateMany({
        where: { id: w.id, status: { in: ["REQUESTED", "APPROVED"] }, payoutReference: reference, transferCode: "" },
        data: { payoutReference: "" },
      });
      return released.count ? "released" : "already";
    }
    if (err instanceof KorapayError) throw new CoinError(`Korapay: ${err.message}`, "STATE");
    throw err;
  }
}

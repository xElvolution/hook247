import { db } from "./db";
import { createTransferRecipient, initiateTransfer, PaystackError } from "./paystack";
import { CoinError, getCoinSettings } from "./coins";
import { markPayoutPaid, rejectPayout } from "./earnings";

export const PAYOUT_REFERENCE_PREFIX = "h247payout_";

/**
 * Pay a withdrawal through Paystack Transfers. Only used when an admin has
 * switched transfers on in coin settings, which should only happen once
 * Transfers are enabled on the Paystack business account.
 *
 * A request is "in flight" while it carries a payout reference and is not yet
 * paid or rejected, so two admins (or an admin and the automatic path) can
 * never send the same payout twice.
 */
export async function payWithdrawalViaPaystack(withdrawalId: string) {
  const settings = await getCoinSettings();
  if (!settings.paystackTransfersEnabled) {
    throw new CoinError("Paystack transfers are switched off in coin settings", "NOT_ALLOWED");
  }
  const w = await db.coinWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { select: { payoutsFrozen: true } } },
  });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status !== "REQUESTED" && w.status !== "APPROVED") throw new CoinError("This withdrawal is already settled", "STATE");
  if (w.payoutReference) throw new CoinError("A transfer for this withdrawal is already in progress", "STATE");
  if (w.user.payoutsFrozen) throw new CoinError("Payouts are frozen for this account", "NOT_ALLOWED");

  const reference = `${PAYOUT_REFERENCE_PREFIX}${w.id.replace(/-/g, "")}`;
  const claimed = await db.coinWithdrawal.updateMany({
    where: { id: w.id, status: { in: ["REQUESTED", "APPROVED"] }, payoutReference: "" },
    data: { status: "APPROVED", approvedAt: w.approvedAt ?? new Date(), payoutReference: reference },
  });
  if (!claimed.count) throw new CoinError("Someone else is already processing this", "STATE");

  try {
    // Reuse the Paystack recipient saved on the account, or create one.
    const saved = w.accountId ? await db.withdrawalAccount.findUnique({ where: { id: w.accountId } }) : null;
    const legacy = !saved ? await db.payoutAccount.findUnique({ where: { userId: w.userId } }) : null;
    const match = (a: { accountNumber: string; bankCode: string } | null) =>
      Boolean(a && a.accountNumber === w.accountNumber && a.bankCode === w.bankCode);
    let recipientCode = match(saved) ? saved!.recipientCode : match(legacy) ? legacy!.recipientCode : "";
    if (!recipientCode) {
      recipientCode = await createTransferRecipient({
        name: w.accountName,
        accountNumber: w.accountNumber,
        bankCode: w.bankCode,
      });
      if (saved && match(saved)) {
        await db.withdrawalAccount.update({ where: { id: saved.id }, data: { recipientCode } });
      } else if (legacy && match(legacy)) {
        await db.payoutAccount.update({ where: { userId: w.userId }, data: { recipientCode } });
      }
    }
    const transfer = await initiateTransfer({
      amountKobo: w.amountKobo,
      recipientCode,
      reference,
      reason: "Hooks247 earnings payout",
    });
    await db.coinWithdrawal.update({ where: { id: w.id }, data: { transferCode: transfer.transferCode } });
    if (transfer.status === "success") {
      await markPayoutPaid(w.id, reference, "Paid by Paystack transfer");
      return { state: "paid" as const };
    }
    // "pending" or "otp": the transfer.success webhook finishes the job.
    return { state: transfer.status };
  } catch (err) {
    // Put the request back so it can be retried or paid by hand.
    await db.coinWithdrawal.updateMany({
      where: { id: w.id, status: "APPROVED", transferCode: "", payoutReference: reference },
      data: { payoutReference: "" },
    });
    if (err instanceof PaystackError) throw new CoinError(`Paystack: ${err.message}`, "STATE");
    throw err;
  }
}

/** Finish a payout when Paystack reports the transfer outcome. */
export async function settleTransferEvent(event: string, reference: string) {
  const w = await db.coinWithdrawal.findFirst({ where: { payoutReference: reference } });
  if (!w) return "unknown";
  if (event === "transfer.success") {
    await markPayoutPaid(w.id, reference, "Paid by Paystack transfer");
    return "paid";
  }
  // Failed or reversed: the money did not arrive, so it goes back to the escort.
  if (w.status === "PAID") {
    console.error(`Transfer ${reference} reported ${event} after it was marked paid; review manually.`);
    return "needs-review";
  }
  await rejectPayout(w.id, `Paystack ${event.replace("transfer.", "transfer ")}`);
  return "refunded";
}

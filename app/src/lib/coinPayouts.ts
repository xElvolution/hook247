import { db } from "./db";
import { createTransferRecipient, initiateTransfer, PaystackError } from "./paystack";
import { CoinError, getCoinSettings, markWithdrawalPaid, rejectWithdrawal } from "./coins";

export const PAYOUT_REFERENCE_PREFIX = "h247payout_";

/**
 * Pay an approved withdrawal through Paystack Transfers. Only used when an
 * admin has switched transfers on in coin settings, which should only happen
 * once Transfers are enabled on the Paystack business account.
 */
export async function payWithdrawalViaPaystack(withdrawalId: string) {
  const settings = await getCoinSettings();
  if (!settings.paystackTransfersEnabled) {
    throw new CoinError("Paystack transfers are switched off in coin settings", "NOT_ALLOWED");
  }
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status !== "REQUESTED") throw new CoinError("Only new requests can be sent to Paystack", "STATE");

  // Claim the row first so two admins pressing Pay cannot send two transfers.
  const reference = `${PAYOUT_REFERENCE_PREFIX}${w.id.replace(/-/g, "")}`;
  const claimed = await db.coinWithdrawal.updateMany({
    where: { id: w.id, status: "REQUESTED" },
    data: { status: "APPROVED", payoutReference: reference },
  });
  if (!claimed.count) throw new CoinError("Someone else is already processing this", "STATE");

  try {
    const account = await db.payoutAccount.findUnique({ where: { userId: w.userId } });
    let recipientCode =
      account && account.accountNumber === w.accountNumber && account.bankCode === w.bankCode ? account.recipientCode : "";
    if (!recipientCode) {
      recipientCode = await createTransferRecipient({
        name: w.accountName,
        accountNumber: w.accountNumber,
        bankCode: w.bankCode,
      });
      if (account && account.accountNumber === w.accountNumber && account.bankCode === w.bankCode) {
        await db.payoutAccount.update({ where: { userId: w.userId }, data: { recipientCode } });
      }
    }
    const transfer = await initiateTransfer({
      amountKobo: w.amountKobo,
      recipientCode,
      reference,
      reason: `Hooks247 payout ${w.coins} coins`,
    });
    await db.coinWithdrawal.update({ where: { id: w.id }, data: { transferCode: transfer.transferCode } });
    if (transfer.status === "success") {
      await markWithdrawalPaid(w.id, reference, "Paid by Paystack transfer");
      return { state: "paid" as const };
    }
    // "pending" or "otp": the transfer.success webhook finishes the job.
    return { state: transfer.status };
  } catch (err) {
    // Put the request back so it can be retried or paid by hand.
    await db.coinWithdrawal.updateMany({
      where: { id: w.id, status: "APPROVED", transferCode: "" },
      data: { status: "REQUESTED", payoutReference: "" },
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
    await markWithdrawalPaid(w.id, reference, "Paid by Paystack transfer");
    return "paid";
  }
  // Failed or reversed: the money did not arrive, so the coins go back.
  if (w.status === "PAID") {
    console.error(`Transfer ${reference} reported ${event} after it was marked paid; review manually.`);
    return "needs-review";
  }
  await rejectWithdrawal(w.id, `Paystack ${event.replace("transfer.", "transfer ")}`);
  return "refunded";
}

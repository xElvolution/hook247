"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { adminAdjust, CoinError, coinPrice, getCoinSettings } from "@/lib/coins";
import { approveWithdrawal, markPayoutPaid, rejectPayout, runLegacyConversion } from "@/lib/earnings";
import { payWithdrawalViaPaystack } from "@/lib/coinPayouts";
import { fulfilCoinPurchase } from "@/lib/coinPurchases";

function back(path: string, message: string, tone: "ok" | "error" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${tone}=${encodeURIComponent(message)}`);
}

export async function saveCoinSettings(formData: FormData) {
  await requireAdmin();
  const escortSharePct = Math.floor(Number(formData.get("escortSharePct")));
  const feePct = Number(String(formData.get("feePct") ?? "").replace(/[^\d.]/g, ""));
  const withdrawalFeeBps = Math.round(feePct * 100);
  const manualWithdrawalApproval = formData.get("manualWithdrawalApproval") === "on";
  const paystackTransfersEnabled = formData.get("paystackTransfersEnabled") === "on";
  if (!Number.isFinite(escortSharePct) || escortSharePct < 1 || escortSharePct > 100) {
    back("/502test/coins", "Escort share must be between 1% and 100%", "error");
  }
  if (!Number.isFinite(withdrawalFeeBps) || withdrawalFeeBps < 0 || withdrawalFeeBps > 5_000) {
    back("/502test/coins", "Withdrawal fee must be between 0% and 50%", "error");
  }
  await getCoinSettings();
  await db.coinSettings.update({
    where: { id: "default" },
    data: { escortSharePct, withdrawalFeeBps, manualWithdrawalApproval, paystackTransfersEnabled },
  });
  await logAdminAction(
    "coins.settings",
    "coins",
    "default",
    `split ${escortSharePct}/${100 - escortSharePct}, fee ${withdrawalFeeBps}bps, manual ${manualWithdrawalApproval ? "on" : "off"}, transfers ${paystackTransfersEnabled ? "on" : "off"}`
  );
  revalidatePath("/502test/coins");
  back("/502test/coins", "Coin settings saved");
}

/** Packs are priced by the fixed coin price, so only the coin count is edited. */
export async function savePack(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const coins = Math.floor(Number(formData.get("coins")));
  const sortOrder = Math.floor(Number(formData.get("sortOrder") ?? 0)) || 0;
  const active = formData.get("active") === "on";
  if (!name || !Number.isFinite(coins) || coins < 1 || coins > 1_000_000) {
    back("/502test/coins", "Packs need a name and between 1 and 1,000,000 coins", "error");
  }
  const priceKobo = coins * coinPrice(await getCoinSettings());
  if (id) {
    await db.coinPack.update({ where: { id }, data: { name, coins, priceKobo, sortOrder, active } });
  } else {
    await db.coinPack.create({ data: { name, coins, priceKobo, sortOrder, active } });
  }
  await logAdminAction(id ? "coins.pack.update" : "coins.pack.create", "coinPack", id || name, `${coins} coins for ${priceKobo}k, ${active ? "active" : "hidden"}`);
  revalidatePath("/502test/coins");
  back("/502test/coins", id ? "Pack updated" : "Pack added");
}

export async function deletePack(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const used = await db.coinPurchase.count({ where: { packId: id } });
  if (used) {
    await db.coinPack.update({ where: { id }, data: { active: false } });
    await logAdminAction("coins.pack.hide", "coinPack", id, "has purchases, hidden instead of deleted");
    revalidatePath("/502test/coins");
    back("/502test/coins", "Pack has purchases, so it was hidden instead of deleted");
  }
  await db.coinPack.delete({ where: { id } });
  await logAdminAction("coins.pack.delete", "coinPack", id, "");
  revalidatePath("/502test/coins");
  back("/502test/coins", "Pack deleted");
}

/** Converts escorts' leftover v1 coins into naira earnings. Needs the typed confirmation. */
export async function convertLegacyCoins(formData: FormData) {
  await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== "CONVERT") {
    back("/502test/coins", "Type CONVERT to confirm the conversion", "error");
  }
  const result = await runLegacyConversion();
  await logAdminAction("coins.legacy.convert", "coins", "default", `${result.converted} escort wallets converted`);
  revalidatePath("/502test/coins");
  back("/502test/coins", `${result.converted} escort wallets converted to earnings`);
}

export async function adjustWallet(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const delta = Math.trunc(Number(formData.get("delta")));
  const note = String(formData.get("note") ?? "").trim();
  const nonce = String(formData.get("nonce") ?? "") || randomUUID();
  const path = `/502test/coins?user=${encodeURIComponent(userId)}`;
  if (!note) back(path, "Add a note explaining the adjustment", "error");
  try {
    await adminAdjust(userId, delta, note, `admin-adjust:${nonce}`);
  } catch (err) {
    if (err instanceof CoinError) back(path, err.message, "error");
    throw err;
  }
  await logAdminAction("coins.adjust", "user", userId, `${delta > 0 ? "+" : ""}${delta}: ${note}`);
  revalidatePath("/502test/coins");
  back(path, "Wallet adjusted");
}

export async function payoutMarkPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120);
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!reference) back("/502test/coin-payouts", "Enter the bank transfer reference", "error");
  try {
    await markPayoutPaid(id, reference, note);
  } catch (err) {
    if (err instanceof CoinError) back("/502test/coin-payouts", err.message, "error");
    throw err;
  }
  await logAdminAction("coins.payout.paid", "coinWithdrawal", id, reference);
  revalidatePath("/502test/coin-payouts");
  back("/502test/coin-payouts", "Marked as paid");
}

export async function payoutReject(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!note) back("/502test/coin-payouts", "Say why the withdrawal is rejected", "error");
  try {
    await rejectPayout(id, note);
  } catch (err) {
    if (err instanceof CoinError) back("/502test/coin-payouts", err.message, "error");
    throw err;
  }
  await logAdminAction("coins.payout.reject", "coinWithdrawal", id, note);
  revalidatePath("/502test/coin-payouts");
  back("/502test/coin-payouts", "Rejected and refunded to the member");
}

export async function payoutApprove(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  try {
    await approveWithdrawal(id, note);
  } catch (err) {
    if (err instanceof CoinError) back("/502test/coin-payouts", err.message, "error");
    throw err;
  }
  await logAdminAction("coins.payout.approve", "coinWithdrawal", id, note);
  revalidatePath("/502test/coin-payouts");
  back("/502test/coin-payouts", "Approved. Send the money, then mark it paid with the reference.");
}

export async function payoutViaPaystack(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  let state = "";
  try {
    state = (await payWithdrawalViaPaystack(id)).state;
  } catch (err) {
    if (err instanceof CoinError) back("/502test/coin-payouts", err.message, "error");
    throw err;
  }
  await logAdminAction("coins.payout.transfer", "coinWithdrawal", id, state);
  revalidatePath("/502test/coin-payouts");
  back(
    "/502test/coin-payouts",
    state === "paid" ? "Paystack transfer sent and marked paid" : `Paystack transfer is ${state}. It completes when Paystack confirms it.`
  );
}

/** Ask Paystack again about a purchase whose webhook never arrived. Safe to repeat. */
export async function recheckPurchase(formData: FormData) {
  await requireAdmin();
  const reference = String(formData.get("reference") ?? "");
  if (!reference) return;
  const result = await fulfilCoinPurchase(reference);
  await logAdminAction("coins.purchase.recheck", "coinPurchase", reference, result.state);
  revalidatePath("/502test/coins");
  back(
    "/502test/coins",
    result.ok ? `Purchase ${result.state === "credited" ? "credited" : "was already credited"}` : `Paystack says: ${result.error}`,
    result.ok ? "ok" : "error"
  );
}

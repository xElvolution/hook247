"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import {
  adminAdjust,
  CoinError,
  getCoinSettings,
  markWithdrawalPaid,
  rejectWithdrawal,
} from "@/lib/coins";
import { payWithdrawalViaPaystack } from "@/lib/coinPayouts";
import { fulfilCoinPurchase } from "@/lib/coinPurchases";

function nairaToKobo(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function back(path: string, message: string, tone: "ok" | "error" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${tone}=${encodeURIComponent(message)}`);
}

export async function saveCoinSettings(formData: FormData) {
  await requireAdmin();
  const payoutKoboPerCoin = nairaToKobo(formData.get("payoutNaira"));
  const minWithdrawalCoins = Math.floor(Number(formData.get("minWithdrawalCoins")));
  const paystackTransfersEnabled = formData.get("paystackTransfersEnabled") === "on";
  if (!Number.isFinite(payoutKoboPerCoin) || payoutKoboPerCoin < 1 || payoutKoboPerCoin > 1_000_000) {
    back("/502test/coins", "Payout rate must be a positive amount in naira", "error");
  }
  if (!Number.isFinite(minWithdrawalCoins) || minWithdrawalCoins < 1) {
    back("/502test/coins", "Minimum withdrawal must be at least 1 coin", "error");
  }
  await getCoinSettings();
  await db.coinSettings.update({
    where: { id: "default" },
    data: { payoutKoboPerCoin, minWithdrawalCoins, paystackTransfersEnabled },
  });
  await logAdminAction(
    "coins.settings",
    "coins",
    "default",
    `payout ${payoutKoboPerCoin}k/coin, min ${minWithdrawalCoins}, transfers ${paystackTransfersEnabled ? "on" : "off"}`
  );
  revalidatePath("/502test/coins");
  back("/502test/coins", "Coin settings saved");
}

export async function savePack(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const coins = Math.floor(Number(formData.get("coins")));
  const priceKobo = nairaToKobo(formData.get("priceNaira"));
  const sortOrder = Math.floor(Number(formData.get("sortOrder") ?? 0)) || 0;
  const active = formData.get("active") === "on";
  if (!name || !Number.isFinite(coins) || coins < 1 || !Number.isFinite(priceKobo) || priceKobo < 10_000) {
    back("/502test/coins", "Packs need a name, at least 1 coin and a price of at least ₦100", "error");
  }
  if (id) {
    await db.coinPack.update({ where: { id }, data: { name, coins, priceKobo, sortOrder, active } });
  } else {
    await db.coinPack.create({ data: { name, coins, priceKobo, sortOrder, active } });
  }
  await logAdminAction(id ? "coins.pack.update" : "coins.pack.create", "coinPack", id || name, `${coins} coins for ${priceKobo}k, ${active ? "active" : "hidden"}`);
  revalidatePath("/502test/coins");
  back("/502test/coins", id ? "Pack updated" : "Pack added");
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
    await markWithdrawalPaid(id, reference, note);
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
    await rejectWithdrawal(id, note);
  } catch (err) {
    if (err instanceof CoinError) back("/502test/coin-payouts", err.message, "error");
    throw err;
  }
  await logAdminAction("coins.payout.reject", "coinWithdrawal", id, note);
  revalidatePath("/502test/coin-payouts");
  back("/502test/coin-payouts", "Rejected and coins refunded");
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

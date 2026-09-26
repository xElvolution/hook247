import { randomUUID } from "node:crypto";
import type { EarningsTxType } from "@prisma/client";
import { db } from "./db";
import {
  applyCoinChange,
  coinPrice,
  CoinError,
  getCoinSettings,
  getWallet,
  isUniqueViolation,
  legacyMarkPaid,
  legacyReject,
  lockWallets,
  TX_OPTIONS,
  type Tx,
} from "./coins";
import { hasActivePaidPlan } from "./eligibility";

/**
 * Coins v2 money flow.
 *
 * Clients buy coins (coins.ts) and spend them on gifts. Every gift is priced at
 * the fixed coin price and split: the escort share lands in the escort's naira
 * Earnings Wallet, the rest is platform revenue. Escorts never hold coins and
 * coins are never paid out as cash.
 *
 * Each money event runs in one database transaction that locks the wallet rows
 * it touches, refuses to take a balance below zero and writes append-only
 * ledger rows (CoinTransaction, EarningsTransaction and the platform-wide
 * LedgerEntry). Every write carries an idempotency key, so a double tap, a
 * retried request or two admins clicking at once can never move money twice.
 */

// ---------------------------------------------------------------- maths

/** Split a gift. Shares are whole kobo; any rounding remainder stays with the platform. */
export function splitGift(coins: number, coinPriceKobo: number, escortSharePct: number) {
  const amountKobo = coins * coinPriceKobo;
  const escortShareKobo = Math.floor((amountKobo * escortSharePct) / 100);
  return { amountKobo, escortShareKobo, platformShareKobo: amountKobo - escortShareKobo };
}

/** Fee on a withdrawal. 200 bps of N10,000 is N200, so N9,800 is sent. */
export function withdrawalFee(grossKobo: number, feeBps: number) {
  const feeKobo = Math.round((grossKobo * feeBps) / 10_000);
  return { grossKobo, feeKobo, payoutKobo: grossKobo - feeKobo };
}

// ---------------------------------------------------------------- wallet

export async function getEarnings(userId: string) {
  const wallet = await db.earningsWallet.findUnique({ where: { userId } });
  return {
    balanceKobo: wallet?.balanceKobo ?? 0,
    heldKobo: wallet?.heldKobo ?? 0,
    lifetimeKobo: wallet?.lifetimeKobo ?? 0,
  };
}

/** Earnings wallet plus what has already been paid out, for the wallet page. */
export async function getEarningsSummary(userId: string) {
  const [wallet, paid] = await Promise.all([
    getEarnings(userId),
    db.coinWithdrawal.aggregate({ where: { userId, source: "earnings", status: "PAID" }, _sum: { grossKobo: true } }),
  ]);
  return { ...wallet, withdrawnKobo: paid._sum.grossKobo ?? 0 };
}

async function lockEarnings(tx: Tx, userId: string) {
  await tx.$executeRaw`
    INSERT INTO "EarningsWallet" ("userId", "balanceKobo", "heldKobo", "lifetimeKobo", "updatedAt")
    VALUES (${userId}, 0, 0, 0, NOW())
    ON CONFLICT ("userId") DO NOTHING`;
  await tx.$queryRaw`SELECT "userId" FROM "EarningsWallet" WHERE "userId" = ${userId} FOR UPDATE`;
}

type EarningsChange = {
  userId: string;
  type: EarningsTxType;
  /** Signed change to the withdrawable balance, in kobo. */
  amountKobo: number;
  /** Signed change to the held balance, in kobo. */
  heldKobo?: number;
  /** Kobo counted toward lifetime earnings. */
  lifetimeKobo?: number;
  idempotencyKey: string;
  ledgerEntryId?: string | null;
  withdrawalId?: string | null;
  note?: string;
};

async function applyEarnings(tx: Tx, change: EarningsChange) {
  const held = change.heldKobo ?? 0;
  const lifetime = change.lifetimeKobo ?? 0;
  const rows = await tx.$queryRaw<{ balanceKobo: number }[]>`
    UPDATE "EarningsWallet"
    SET "balanceKobo" = "balanceKobo" + ${change.amountKobo},
        "heldKobo" = "heldKobo" + ${held},
        "lifetimeKobo" = "lifetimeKobo" + ${lifetime},
        "updatedAt" = NOW()
    WHERE "userId" = ${change.userId}
      AND "balanceKobo" + ${change.amountKobo} >= 0
      AND "heldKobo" + ${held} >= 0
    RETURNING "balanceKobo"`;
  if (!rows.length) throw new CoinError("Not enough earnings for that", "INSUFFICIENT");
  return tx.earningsTransaction.create({
    data: {
      userId: change.userId,
      type: change.type,
      amountKobo: change.amountKobo,
      heldKobo: held,
      balanceAfterKobo: rows[0].balanceKobo,
      idempotencyKey: change.idempotencyKey,
      ledgerEntryId: change.ledgerEntryId ?? null,
      withdrawalId: change.withdrawalId ?? null,
      note: (change.note ?? "").slice(0, 300),
    },
  });
}

// ---------------------------------------------------------------- gifts

export const MAX_GIFT_COINS = 100_000;

export type GiftInput = {
  fromId: string;
  toId: string;
  /** Client generated, so a retried tap reuses it. */
  nonce: string;
  source: "live" | "profile" | "post";
  /** A catalogue gift. Without one, `coins` is a free amount tip. */
  giftId?: string | null;
  coins?: number;
  liveSessionId?: string | null;
  postId?: string | null;
};

/**
 * Send a gift: coins leave the sender, the escort share lands in the
 * recipient's Earnings Wallet and the platform ledger records the split.
 */
export async function sendGift(input: GiftInput) {
  if (input.fromId === input.toId) throw new CoinError("You cannot send a gift to yourself", "NOT_ALLOWED");

  let coins = Math.floor(input.coins ?? 0);
  let giftName = "Tip";
  let giftEmoji = "🪙";
  let animation = "float";
  if (input.giftId) {
    const gift = await db.liveGift.findFirst({ where: { id: input.giftId, active: true, deletedAt: null } });
    if (!gift) throw new CoinError("That gift is no longer available", "NOT_FOUND");
    coins = gift.coins;
    giftName = gift.name;
    giftEmoji = gift.emoji;
    animation = gift.animation;
  }
  if (!Number.isFinite(coins) || coins < 1 || coins > MAX_GIFT_COINS) {
    throw new CoinError(`Gifts are between 1 and ${MAX_GIFT_COINS.toLocaleString("en-NG")} coins`, "INVALID");
  }

  const [recipient, sender] = await Promise.all([
    db.user.findUnique({
      where: { id: input.toId },
      select: {
        bannedAt: true,
        suspendedUntil: true,
        giftingDisabled: true,
        profile: { select: { role: true, displayName: true, plan: true, subscriptionExpiresAt: true } },
      },
    }),
    db.user.findUnique({ where: { id: input.fromId }, select: { giftingDisabled: true } }),
  ]);
  if (!sender) throw new CoinError("Sign in to send gifts", "NOT_ALLOWED");
  if (sender.giftingDisabled) throw new CoinError("Gifting is switched off on your account", "NOT_ALLOWED");
  if (!recipient || recipient.bannedAt || !recipient.profile) {
    throw new CoinError("This member cannot receive gifts right now", "NOT_FOUND");
  }
  if (recipient.profile.role !== "ESCORT") throw new CoinError("Only escort profiles can receive gifts", "NOT_ALLOWED");
  if (recipient.giftingDisabled || (recipient.suspendedUntil && recipient.suspendedUntil > new Date())) {
    throw new CoinError("This member cannot receive gifts right now", "NOT_ALLOWED");
  }

  // A live only starts on an active paid plan. If the plan runs out while the
  // host is still streaming, gifts sent to that live are still credited; the
  // lock applies from the next time they try to go live.
  let liveCovered = false;
  if (input.source === "live" && input.liveSessionId) {
    const session = await db.liveSession.findUnique({
      where: { id: input.liveSessionId },
      select: { hostId: true, status: true },
    });
    if (!session || session.hostId !== input.toId || session.status !== "LIVE") {
      throw new CoinError("This live has ended", "STATE");
    }
    liveCovered = true;
  }
  if (!liveCovered && !hasActivePaidPlan(recipient.profile)) {
    throw new CoinError(`${recipient.profile.displayName} cannot receive gifts right now`, "NOT_ELIGIBLE");
  }

  const settings = await getCoinSettings();
  const price = coinPrice(settings);
  const split = splitGift(coins, price, settings.escortSharePct);
  const key = `gift:${input.fromId}:${input.nonce}`;
  const note = `${giftEmoji} ${giftName}`;

  const existing = await db.ledgerEntry.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    return {
      duplicate: true,
      coins: existing.coins,
      balance: (await getWallet(input.fromId)).balance,
      recipientName: recipient.profile.displayName,
      ledgerId: existing.id,
      escortShareKobo: existing.escortShareKobo,
      giftName: existing.giftName,
      emoji: existing.giftEmoji,
      animation,
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Coin wallets first, then earnings wallets: every path locks in this
      // order, so concurrent gifts and withdrawals cannot deadlock.
      await lockWallets(tx, [input.fromId]);
      await lockEarnings(tx, input.toId);
      const sent = await applyCoinChange(tx, {
        userId: input.fromId,
        type: "GIFT_SENT",
        amount: -coins,
        idempotencyKey: key,
        counterpartyId: input.toId,
        liveSessionId: input.liveSessionId ?? null,
        postId: input.postId ?? null,
        giftId: input.giftId ?? null,
        source: input.source,
        note,
      });
      const entry = await tx.ledgerEntry.create({
        data: {
          kind: "GIFT",
          status: "COMPLETED",
          idempotencyKey: key,
          senderId: input.fromId,
          receiverId: input.toId,
          giftId: input.giftId ?? null,
          giftName,
          giftEmoji,
          coins,
          coinPriceKobo: price,
          amountKobo: split.amountKobo,
          escortSharePct: settings.escortSharePct,
          escortShareKobo: split.escortShareKobo,
          platformShareKobo: split.platformShareKobo,
          liveSessionId: input.liveSessionId ?? null,
          postId: input.postId ?? null,
          source: input.source,
          note,
        },
      });
      if (split.escortShareKobo > 0) {
        await applyEarnings(tx, {
          userId: input.toId,
          type: "GIFT_SHARE",
          amountKobo: split.escortShareKobo,
          lifetimeKobo: split.escortShareKobo,
          idempotencyKey: `${key}:share`,
          ledgerEntryId: entry.id,
          note,
        });
      }
      return { sent, entry };
    }, TX_OPTIONS);
    return {
      duplicate: false,
      coins,
      balance: result.sent.balanceAfter,
      recipientName: recipient.profile.displayName,
      ledgerId: result.entry.id,
      escortShareKobo: split.escortShareKobo,
      giftName,
      emoji: giftEmoji,
      animation,
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const again = await db.ledgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (again) {
        return {
          duplicate: true,
          coins: again.coins,
          balance: (await getWallet(input.fromId)).balance,
          recipientName: recipient.profile.displayName,
          ledgerId: again.id,
          escortShareKobo: again.escortShareKobo,
          giftName: again.giftName,
          emoji: again.giftEmoji,
          animation,
        };
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------- withdrawal accounts

export async function listWithdrawalAccounts(userId: string) {
  return db.withdrawalAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export const MAX_WITHDRAWAL_ACCOUNTS = 5;

/** Save a bank account whose name has already been confirmed with Paystack. */
export async function saveWithdrawalAccount(input: {
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  const count = await db.withdrawalAccount.count({ where: { userId: input.userId } });
  const existing = await db.withdrawalAccount.findUnique({
    where: { userId_bankCode_accountNumber: { userId: input.userId, bankCode: input.bankCode, accountNumber: input.accountNumber } },
  });
  if (!existing && count >= MAX_WITHDRAWAL_ACCOUNTS) {
    throw new CoinError(`You can save up to ${MAX_WITHDRAWAL_ACCOUNTS} accounts. Remove one first.`, "INVALID");
  }
  return db.withdrawalAccount.upsert({
    where: { userId_bankCode_accountNumber: { userId: input.userId, bankCode: input.bankCode, accountNumber: input.accountNumber } },
    create: { ...input, isDefault: count === 0 },
    update: { bankName: input.bankName, accountName: input.accountName },
  });
}

export async function setDefaultWithdrawalAccount(userId: string, accountId: string) {
  const account = await db.withdrawalAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new CoinError("Account not found", "NOT_FOUND");
  await db.$transaction([
    db.withdrawalAccount.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    db.withdrawalAccount.update({ where: { id: accountId }, data: { isDefault: true } }),
  ]);
}

export async function removeWithdrawalAccount(userId: string, accountId: string) {
  const account = await db.withdrawalAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new CoinError("Account not found", "NOT_FOUND");
  const open = await db.coinWithdrawal.count({
    where: { userId, accountId, status: { in: ["REQUESTED", "APPROVED"] } },
  });
  if (open) throw new CoinError("This account has a withdrawal in progress", "STATE");
  await db.withdrawalAccount.delete({ where: { id: accountId } });
  if (account.isDefault) {
    const next = await db.withdrawalAccount.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (next) await db.withdrawalAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

// ---------------------------------------------------------------- withdrawals

const OPEN = ["REQUESTED", "APPROVED"] as const;

/** Who may withdraw right now. Shared by the quote and the request. */
async function checkWithdrawer(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      bannedAt: true,
      suspendedUntil: true,
      payoutsFrozen: true,
      profile: { select: { role: true, plan: true, subscriptionExpiresAt: true } },
    },
  });
  if (!user || !user.profile) throw new CoinError("Sign in first", "NOT_ALLOWED");
  if (user.profile.role !== "ESCORT") throw new CoinError("Withdrawals are for escort accounts", "NOT_ALLOWED");
  if (user.bannedAt || (user.suspendedUntil && user.suspendedUntil > new Date())) {
    throw new CoinError("Your account cannot withdraw right now", "NOT_ALLOWED");
  }
  if (user.payoutsFrozen) throw new CoinError("Withdrawals are on hold for your account. Contact support.", "NOT_ALLOWED");
  if (!hasActivePaidPlan(user.profile)) {
    throw new CoinError("Withdrawals need an active paid plan. Renew your plan to cash out.", "NOT_ELIGIBLE");
  }
}

/** What a withdrawal of `grossKobo` would send, with the current fee. Nothing is moved. */
export async function quoteEarningsWithdrawal(userId: string, grossKobo: number) {
  const gross = Math.floor(grossKobo);
  if (!Number.isFinite(gross) || gross < 1) throw new CoinError("Enter an amount to withdraw", "INVALID");
  await checkWithdrawer(userId);
  const [settings, wallet] = await Promise.all([getCoinSettings(), getEarnings(userId)]);
  if (gross > wallet.balanceKobo) throw new CoinError("That is more than your available earnings", "INSUFFICIENT");
  const quote = withdrawalFee(gross, settings.withdrawalFeeBps);
  if (quote.payoutKobo < 1) throw new CoinError("That amount is too small to send after the fee", "INVALID");
  return { ...quote, feeBps: settings.withdrawalFeeBps, balanceKobo: wallet.balanceKobo };
}

/**
 * Request a payout from the Earnings Wallet. The gross amount moves from
 * available to held at once, so it cannot be spent twice; it leaves the wallet
 * for good when the payout is marked paid, or goes back if it is rejected.
 */
export async function requestEarningsWithdrawal(input: {
  userId: string;
  grossKobo: number;
  accountId: string;
  /** The fee and payout the escort confirmed. If they changed since, nothing happens. */
  expectedFeeKobo?: number;
  expectedPayoutKobo?: number;
}) {
  const quote = await quoteEarningsWithdrawal(input.userId, input.grossKobo);
  if (
    (input.expectedFeeKobo !== undefined && input.expectedFeeKobo !== quote.feeKobo) ||
    (input.expectedPayoutKobo !== undefined && input.expectedPayoutKobo !== quote.payoutKobo)
  ) {
    throw new CoinError("The fee has changed. Check the new amount and confirm again.", "CHANGED");
  }
  const account = await db.withdrawalAccount.findFirst({ where: { id: input.accountId, userId: input.userId } });
  if (!account) throw new CoinError("Choose one of your saved accounts", "NOT_FOUND");
  const open = await db.coinWithdrawal.count({ where: { userId: input.userId, status: { in: [...OPEN] } } });
  if (open) throw new CoinError("You already have a withdrawal being processed", "STATE");

  const settings = await getCoinSettings();
  const manual = settings.manualWithdrawalApproval;
  const withdrawalId = randomUUID();
  const masked = `${"*".repeat(Math.max(account.accountNumber.length - 4, 0))}${account.accountNumber.slice(-4)}`;

  try {
    const result = await db.$transaction(async (tx) => {
      await lockEarnings(tx, input.userId);
      const hold = await applyEarnings(tx, {
        userId: input.userId,
        type: "WITHDRAWAL_HOLD",
        amountKobo: -quote.grossKobo,
        heldKobo: quote.grossKobo,
        idempotencyKey: `withdrawal-hold:${withdrawalId}`,
        withdrawalId,
        note: `To ${account.bankName} ${masked}`,
      });
      const withdrawal = await tx.coinWithdrawal.create({
        data: {
          id: withdrawalId,
          userId: input.userId,
          coins: 0,
          source: "earnings",
          grossKobo: quote.grossKobo,
          feeKobo: quote.feeKobo,
          feeBps: quote.feeBps,
          amountKobo: quote.payoutKobo,
          accountId: account.id,
          bankCode: account.bankCode,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          status: manual ? "REQUESTED" : "APPROVED",
          approvedAt: manual ? null : new Date(),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          kind: "WITHDRAWAL_REQUEST",
          status: "PENDING",
          idempotencyKey: `withdrawal-request:${withdrawalId}`,
          receiverId: input.userId,
          amountKobo: quote.grossKobo,
          feeKobo: quote.feeKobo,
          payoutKobo: quote.payoutKobo,
          withdrawalId,
          source: "earnings",
          note: `To ${account.bankName} ${masked}${manual ? "" : ", approved automatically"}`,
        },
      });
      return { withdrawal, balanceKobo: hold.balanceAfterKobo };
    }, TX_OPTIONS);

    if (!manual && settings.paystackTransfersEnabled) {
      // Imported lazily: coinPayouts depends on this module.
      const { payWithdrawalViaPaystack } = await import("./coinPayouts");
      await payWithdrawalViaPaystack(withdrawalId).catch((err) =>
        console.error("Automatic payout transfer failed; left for the payout queue:", (err as Error).message)
      );
    }
    return result;
  } catch (err) {
    // The one-open-withdrawal index caught a double submit.
    if (isUniqueViolation(err)) throw new CoinError("You already have a withdrawal being processed", "STATE");
    throw err;
  }
}

/** Admin: approve a request when manual approval is on. The payout is sent afterwards. */
export async function approveWithdrawal(withdrawalId: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { select: { payoutsFrozen: true } } },
  });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status === "APPROVED") return w;
  if (w.status !== "REQUESTED") throw new CoinError("Only new requests can be approved", "STATE");
  if (w.user.payoutsFrozen) throw new CoinError("Payouts are frozen for this account", "NOT_ALLOWED");
  return db.$transaction(async (tx) => {
    const updated = await tx.coinWithdrawal.updateMany({
      where: { id: w.id, status: "REQUESTED" },
      data: { status: "APPROVED", approvedAt: new Date(), adminNote: note },
    });
    if (!updated.count) throw new CoinError("Someone else already handled this request", "STATE");
    await tx.ledgerEntry.create({
      data: {
        kind: "WITHDRAWAL_APPROVED",
        status: "PENDING",
        idempotencyKey: `withdrawal-approved:${w.id}`,
        receiverId: w.userId,
        amountKobo: w.source === "earnings" ? w.grossKobo : w.amountKobo,
        feeKobo: w.feeKobo,
        payoutKobo: w.amountKobo,
        withdrawalId: w.id,
        source: w.source,
        note: note.slice(0, 300),
      },
    });
    return tx.coinWithdrawal.findUnique({ where: { id: w.id } });
  }, TX_OPTIONS);
}

/** The payout reached the bank. The held amount leaves the wallet for good. */
export async function markPayoutPaid(withdrawalId: string, payoutReference: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.source !== "earnings") return legacyMarkPaid(withdrawalId, payoutReference, note);
  if (w.status === "PAID") return w;
  if (w.status === "REJECTED") throw new CoinError("This withdrawal was rejected", "STATE");
  return db.$transaction(async (tx) => {
    const updated = await tx.coinWithdrawal.updateMany({
      where: { id: w.id, status: { in: [...OPEN] } },
      data: { status: "PAID", payoutReference, adminNote: note, resolvedAt: new Date(), approvedAt: w.approvedAt ?? new Date() },
    });
    if (!updated.count) throw new CoinError("Withdrawal already settled", "STATE");
    await lockEarnings(tx, w.userId);
    await applyEarnings(tx, {
      userId: w.userId,
      type: "WITHDRAWAL_PAID",
      amountKobo: 0,
      heldKobo: -w.grossKobo,
      idempotencyKey: `withdrawal-paid:${w.id}`,
      withdrawalId: w.id,
      note: payoutReference ? `Paid, ref ${payoutReference}` : "Paid",
    });
    await tx.ledgerEntry.create({
      data: {
        kind: "WITHDRAWAL_PAID",
        status: "COMPLETED",
        idempotencyKey: `withdrawal-paid:${w.id}`,
        receiverId: w.userId,
        amountKobo: w.grossKobo,
        feeKobo: w.feeKobo,
        payoutKobo: w.amountKobo,
        withdrawalId: w.id,
        source: "earnings",
        note: [payoutReference && `ref ${payoutReference}`, note].filter(Boolean).join(" · ").slice(0, 300),
      },
    });
    return tx.coinWithdrawal.findUnique({ where: { id: w.id } });
  }, TX_OPTIONS);
}

/** Refuse a payout. The held amount goes back to the escort's available earnings. */
export async function rejectPayout(withdrawalId: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.source !== "earnings") return legacyReject(withdrawalId, note);
  if (w.status === "REJECTED") return w;
  if (w.status === "PAID") throw new CoinError("This withdrawal was already paid", "STATE");
  return db.$transaction(async (tx) => {
    const updated = await tx.coinWithdrawal.updateMany({
      where: { id: w.id, status: { in: [...OPEN] } },
      data: { status: "REJECTED", adminNote: note, resolvedAt: new Date() },
    });
    if (!updated.count) throw new CoinError("Withdrawal already settled", "STATE");
    await lockEarnings(tx, w.userId);
    await applyEarnings(tx, {
      userId: w.userId,
      type: "WITHDRAWAL_RELEASE",
      amountKobo: w.grossKobo,
      heldKobo: -w.grossKobo,
      idempotencyKey: `withdrawal-release:${w.id}`,
      withdrawalId: w.id,
      note: note ? `Returned: ${note}` : "Returned",
    });
    await tx.ledgerEntry.create({
      data: {
        kind: "WITHDRAWAL_REJECTED",
        status: "REVERSED",
        idempotencyKey: `withdrawal-rejected:${w.id}`,
        receiverId: w.userId,
        amountKobo: w.grossKobo,
        feeKobo: w.feeKobo,
        payoutKobo: w.amountKobo,
        withdrawalId: w.id,
        source: "earnings",
        note: note.slice(0, 300),
      },
    });
    return tx.coinWithdrawal.findUnique({ where: { id: w.id } });
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------- legacy conversion

/**
 * Escort coin balances left over from coins v1, and what they would convert
 * to at the v1 payout rate. Nothing is moved.
 */
export async function legacyConversionPreview() {
  const settings = await getCoinSettings();
  const wallets = await db.coinWallet.findMany({
    where: { balance: { gt: 0 }, user: { profile: { role: "ESCORT" } } },
    include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    orderBy: { balance: "desc" },
  });
  return {
    rateKobo: settings.payoutKoboPerCoin,
    convertedAt: settings.legacyConvertedAt,
    rows: wallets.map((w) => ({
      userId: w.userId,
      name: w.user.profile?.displayName ?? w.user.email,
      email: w.user.email,
      coins: w.balance,
      held: w.held,
      lifetimeEarned: w.lifetimeEarned,
      nairaKobo: w.balance * settings.payoutKoboPerCoin,
    })),
  };
}

/**
 * Convert every escort's leftover v1 coins into naira earnings at the v1
 * payout rate. Client coin balances are never touched. Safe to run twice: each
 * member's conversion is keyed, so a second run skips anyone already done.
 */
export async function runLegacyConversion() {
  const preview = await legacyConversionPreview();
  let converted = 0;
  for (const row of preview.rows) {
    const key = `legacy-conversion:${row.userId}`;
    if (await db.ledgerEntry.findUnique({ where: { idempotencyKey: key } })) continue;
    await db.$transaction(async (tx) => {
      await lockWallets(tx, [row.userId]);
      const wallet = await tx.coinWallet.findUnique({ where: { userId: row.userId } });
      const coins = wallet?.balance ?? 0;
      if (coins < 1) return;
      const naira = coins * preview.rateKobo;
      await lockEarnings(tx, row.userId);
      await applyCoinChange(tx, {
        userId: row.userId,
        type: "LEGACY_CONVERSION",
        amount: -coins,
        idempotencyKey: key,
        source: "legacy",
        note: `${coins} coins converted to earnings`,
      });
      const entry = await tx.ledgerEntry.create({
        data: {
          kind: "LEGACY_CONVERSION",
          status: "COMPLETED",
          idempotencyKey: key,
          receiverId: row.userId,
          coins,
          coinPriceKobo: preview.rateKobo,
          amountKobo: naira,
          escortShareKobo: naira,
          source: "legacy",
          note: `v1 coins at ${preview.rateKobo} kobo each`,
        },
      });
      await applyEarnings(tx, {
        userId: row.userId,
        type: "LEGACY_CONVERSION",
        amountKobo: naira,
        lifetimeKobo: naira,
        idempotencyKey: `${key}:earnings`,
        ledgerEntryId: entry.id,
        note: `${coins} v1 coins`,
      });
    }, TX_OPTIONS);
    converted += 1;
  }
  await db.coinSettings.update({ where: { id: "default" }, data: { legacyConvertedAt: new Date() } });
  return { converted };
}

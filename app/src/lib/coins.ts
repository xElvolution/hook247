import { randomUUID } from "node:crypto";
import { Prisma, type CoinTxType } from "@prisma/client";
import { db } from "./db";

/**
 * Coin wallet. Every balance change goes through `move()`, which runs inside a
 * database transaction that locks the affected wallet rows, applies the change
 * with a guard that refuses to go below zero, and writes the matching ledger
 * row. Retried requests carry an idempotency key, so a double tap, a webhook
 * replay or a callback/webhook race can never move coins twice.
 */

export class CoinError extends Error {
  constructor(
    message: string,
    public code: "INSUFFICIENT" | "INVALID" | "NOT_ALLOWED" | "NOT_FOUND" | "STATE" | "CHANGED"
  ) {
    super(message);
  }
}

/** The transaction client handed to interactive transactions on our extended client. */
type Tx = Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

export const DEFAULT_PACKS = [
  { name: "Starter", coins: 100, priceKobo: 150_000, sortOrder: 1 },
  { name: "Popular", coins: 500, priceKobo: 700_000, sortOrder: 2 },
  { name: "Big spender", coins: 1_000, priceKobo: 1_350_000, sortOrder: 3 },
  { name: "Best value", coins: 5_000, priceKobo: 6_500_000, sortOrder: 4 },
];

export async function getCoinSettings() {
  return db.coinSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

/** Seed the default packs the first time the coin store is opened. */
export async function ensureCoinCatalog() {
  const count = await db.coinPack.count();
  if (count === 0) await db.coinPack.createMany({ data: DEFAULT_PACKS });
}

export async function activePacks() {
  await ensureCoinCatalog();
  return db.coinPack.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] });
}

export async function getWallet(userId: string) {
  const wallet = await db.coinWallet.findUnique({ where: { userId } });
  return { balance: wallet?.balance ?? 0, held: wallet?.held ?? 0, lifetimeEarned: wallet?.lifetimeEarned ?? 0 };
}

async function lockWallets(tx: Tx, userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  await tx.$executeRaw`
    INSERT INTO "CoinWallet" ("userId", "balance", "held", "lifetimeEarned", "updatedAt")
    SELECT id, 0, 0, 0, NOW() FROM unnest(${ids}::text[]) AS id
    ON CONFLICT ("userId") DO NOTHING`;
  // Lock in a fixed order so two members tipping each other at the same
  // moment cannot deadlock.
  await tx.$queryRaw`
    SELECT "userId" FROM "CoinWallet" WHERE "userId" = ANY(${ids}::text[]) ORDER BY "userId" FOR UPDATE`;
}

type Change = {
  userId: string;
  type: CoinTxType;
  /** Signed change to the spendable balance. */
  amount: number;
  /** Signed change to coins held for a pending withdrawal. */
  held?: number;
  /** Coins counted toward lifetime earnings (tips received). */
  earned?: number;
  idempotencyKey?: string | null;
  counterpartyId?: string | null;
  postId?: string | null;
  liveSessionId?: string | null;
  giftId?: string | null;
  purchaseId?: string | null;
  withdrawalId?: string | null;
  source?: string;
  note?: string;
};

async function apply(tx: Tx, change: Change) {
  const held = change.held ?? 0;
  const earned = change.earned ?? 0;
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    UPDATE "CoinWallet"
    SET "balance" = "balance" + ${change.amount},
        "held" = "held" + ${held},
        "lifetimeEarned" = "lifetimeEarned" + ${earned},
        "updatedAt" = NOW()
    WHERE "userId" = ${change.userId}
      AND "balance" + ${change.amount} >= 0
      AND "held" + ${held} >= 0
    RETURNING "balance"`;
  if (!rows.length) throw new CoinError("Not enough coins", "INSUFFICIENT");
  return tx.coinTransaction.create({
    data: {
      userId: change.userId,
      type: change.type,
      amount: change.amount,
      balanceAfter: rows[0].balance,
      idempotencyKey: change.idempotencyKey ?? null,
      counterpartyId: change.counterpartyId ?? null,
      postId: change.postId ?? null,
      liveSessionId: change.liveSessionId ?? null,
      giftId: change.giftId ?? null,
      purchaseId: change.purchaseId ?? null,
      withdrawalId: change.withdrawalId ?? null,
      source: change.source ?? "",
      note: change.note ?? "",
    },
  });
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Run a set of ledger changes atomically. If the first change's idempotency
 * key was already used, nothing happens and the earlier result is reported.
 */
async function move<T>(
  changes: Change[],
  extra?: (tx: Tx) => Promise<T>
): Promise<{ duplicate: boolean; entries: Awaited<ReturnType<typeof apply>>[]; extra?: T }> {
  const key = changes[0]?.idempotencyKey;
  if (key) {
    const existing = await db.coinTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { duplicate: true, entries: [existing] };
  }
  try {
    return await db.$transaction(async (tx) => {
      await lockWallets(tx, changes.map((c) => c.userId));
      const entries = [];
      for (const change of changes) entries.push(await apply(tx, change));
      const result = extra ? await extra(tx) : undefined;
      return { duplicate: false, entries, extra: result };
    }, TX_OPTIONS);
  } catch (err) {
    if (key && isUniqueViolation(err)) {
      const existing = await db.coinTransaction.findUnique({ where: { idempotencyKey: key } });
      if (existing) return { duplicate: true, entries: [existing] };
    }
    throw err;
  }
}

// ---------------------------------------------------------------- purchases

/**
 * Credit a paid coin purchase. Safe to call from the Paystack callback, the
 * webhook and the admin retry button at once: the purchase row is claimed and
 * the coins credited inside the same transaction, keyed on the reference.
 */
export async function creditPurchase(reference: string, verifiedAmountKobo: number) {
  const purchase = await db.coinPurchase.findUnique({ where: { reference } });
  if (!purchase) throw new CoinError("Unknown purchase", "NOT_FOUND");
  if (purchase.status === "SUCCESS") return { credited: false, already: true, coins: purchase.coins };
  if (verifiedAmountKobo !== purchase.amountKobo) {
    await db.coinPurchase.updateMany({ where: { id: purchase.id, status: "PENDING" }, data: { status: "FAILED" } });
    throw new CoinError("Paid amount does not match the pack price", "STATE");
  }

  const result = await move(
    [
      {
        userId: purchase.userId,
        type: "PURCHASE",
        amount: purchase.coins,
        idempotencyKey: `purchase:${reference}`,
        purchaseId: purchase.id,
        source: "paystack",
        note: `${purchase.coins} coins`,
      },
    ],
    async (tx) => {
      const claimed = await tx.coinPurchase.updateMany({
        where: { id: purchase.id, status: { in: ["PENDING", "ABANDONED", "FAILED"] } },
        data: { status: "SUCCESS", creditedAt: new Date() },
      });
      if (claimed.count === 0) throw new CoinError("Purchase already settled", "STATE");
      return claimed.count;
    }
  ).catch(async (err) => {
    if (err instanceof CoinError && err.code === "STATE") {
      return { duplicate: true, entries: [] };
    }
    throw err;
  });
  return { credited: !result.duplicate, already: result.duplicate, coins: purchase.coins };
}

// ---------------------------------------------------------------- tipping

export const MAX_TIP = 100_000;

export async function sendTip(input: {
  fromId: string;
  toId: string;
  coins: number;
  nonce: string;
  source: "profile" | "post" | "live";
  postId?: string | null;
  liveSessionId?: string | null;
  giftId?: string | null;
  note?: string;
}) {
  const coins = Math.floor(input.coins);
  if (!Number.isFinite(coins) || coins < 1 || coins > MAX_TIP) {
    throw new CoinError(`Tips are between 1 and ${MAX_TIP.toLocaleString("en-NG")} coins`, "INVALID");
  }
  if (input.fromId === input.toId) throw new CoinError("You cannot tip yourself", "NOT_ALLOWED");

  const recipient = await db.user.findUnique({
    where: { id: input.toId },
    select: { bannedAt: true, profile: { select: { role: true, displayName: true } } },
  });
  if (!recipient || recipient.bannedAt || !recipient.profile) {
    throw new CoinError("This member cannot receive tips right now", "NOT_FOUND");
  }
  if (recipient.profile.role !== "ESCORT") {
    throw new CoinError("Only escort profiles can receive tips", "NOT_ALLOWED");
  }

  const key = `tip:${input.fromId}:${input.nonce}`;
  const shared = {
    postId: input.postId ?? null,
    liveSessionId: input.liveSessionId ?? null,
    giftId: input.giftId ?? null,
    source: input.source,
    note: input.note ?? "",
  };
  const result = await move([
    { ...shared, userId: input.fromId, type: "TIP_SENT", amount: -coins, idempotencyKey: key, counterpartyId: input.toId },
    { ...shared, userId: input.toId, type: "TIP_RECEIVED", amount: coins, earned: coins, idempotencyKey: `${key}:in`, counterpartyId: input.fromId },
  ]);
  const sent = result.entries[0];
  return {
    duplicate: result.duplicate,
    coins,
    balance: sent?.balanceAfter ?? (await getWallet(input.fromId)).balance,
    recipientName: recipient.profile.displayName,
  };
}

// ---------------------------------------------------------------- withdrawals

/**
 * Check a withdrawal amount and work out what it pays. Shared by the quote
 * shown in the confirm step and the request itself, so the figure the escort
 * confirms is computed exactly the way the stored payout is.
 */
async function checkWithdrawal(userId: string, requested: number) {
  const coins = Math.floor(requested);
  const settings = await getCoinSettings();
  if (!Number.isFinite(coins) || coins < settings.minWithdrawalCoins) {
    throw new CoinError(`The minimum withdrawal is ${settings.minWithdrawalCoins.toLocaleString("en-NG")} coins`, "INVALID");
  }
  const profile = await db.profile.findUnique({ where: { userId }, select: { role: true } });
  if (profile?.role !== "ESCORT") throw new CoinError("Withdrawals are for escort accounts", "NOT_ALLOWED");

  const open = await db.coinWithdrawal.count({
    where: { userId, status: { in: ["REQUESTED", "APPROVED"] } },
  });
  if (open > 0) throw new CoinError("You already have a withdrawal being processed", "STATE");

  const wallet = await getWallet(userId);
  if (coins > wallet.balance) {
    throw new CoinError(`You only have ${wallet.balance.toLocaleString("en-NG")} coins available`, "INSUFFICIENT");
  }
  return { coins, amountKobo: coins * settings.payoutKoboPerCoin, balance: wallet.balance };
}

/** What a withdrawal of `coins` would pay right now. Nothing is moved. */
export async function quoteWithdrawal(userId: string, coins: number) {
  const { amountKobo, balance, coins: whole } = await checkWithdrawal(userId, coins);
  return { coins: whole, amountKobo, balance };
}

export async function requestWithdrawal(input: {
  userId: string;
  coins: number;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  /** The amount the escort confirmed. If the rate changed since the quote, the request is refused. */
  expectedAmountKobo?: number;
}) {
  const { coins, amountKobo } = await checkWithdrawal(input.userId, input.coins);
  if (input.expectedAmountKobo !== undefined && input.expectedAmountKobo !== amountKobo) {
    throw new CoinError("The payout amount has changed. Review the new amount and confirm again.", "CHANGED");
  }
  const withdrawalId = randomUUID();
  const result = await move(
    [
      {
        userId: input.userId,
        type: "WITHDRAWAL_REQUEST",
        amount: -coins,
        held: coins,
        withdrawalId,
        idempotencyKey: `withdrawal-request:${withdrawalId}`,
        source: "withdrawal",
        note: `${coins} coins to ${input.bankName} ${input.accountNumber.slice(-4).padStart(input.accountNumber.length, "*")}`,
      },
    ],
    async (tx) => {
      const withdrawal = await tx.coinWithdrawal.create({
        data: {
          id: withdrawalId,
          userId: input.userId,
          coins,
          amountKobo,
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
        },
      });
      return withdrawal;
    }
  );
  const withdrawal = result.extra!;
  return { withdrawal, balance: result.entries[0].balanceAfter };
}

/** Admin: the payout was sent. Releases the held coins for good. */
export async function markWithdrawalPaid(withdrawalId: string, payoutReference: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status === "PAID") return w;
  if (w.status === "REJECTED") throw new CoinError("This withdrawal was rejected", "STATE");
  const result = await move(
    [
      {
        userId: w.userId,
        type: "WITHDRAWAL_PAID",
        amount: 0,
        held: -w.coins,
        idempotencyKey: `withdrawal-paid:${w.id}`,
        withdrawalId: w.id,
        source: "withdrawal",
        note: payoutReference ? `Paid, ref ${payoutReference}` : "Paid",
      },
    ],
    async (tx) => {
      const updated = await tx.coinWithdrawal.updateMany({
        where: { id: w.id, status: { in: ["REQUESTED", "APPROVED"] } },
        data: { status: "PAID", payoutReference, adminNote: note, resolvedAt: new Date() },
      });
      if (!updated.count) throw new CoinError("Withdrawal already settled", "STATE");
      return updated.count;
    }
  );
  return result;
}

/** Admin: refuse the request and give the coins back. */
export async function rejectWithdrawal(withdrawalId: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.status === "REJECTED") return w;
  if (w.status === "PAID") throw new CoinError("This withdrawal was already paid", "STATE");
  return move(
    [
      {
        userId: w.userId,
        type: "WITHDRAWAL_REFUND",
        amount: w.coins,
        held: -w.coins,
        idempotencyKey: `withdrawal-refund:${w.id}`,
        withdrawalId: w.id,
        source: "withdrawal",
        note: note ? `Refunded: ${note}` : "Refunded",
      },
    ],
    async (tx) => {
      const updated = await tx.coinWithdrawal.updateMany({
        where: { id: w.id, status: { in: ["REQUESTED", "APPROVED"] } },
        data: { status: "REJECTED", adminNote: note, resolvedAt: new Date() },
      });
      if (!updated.count) throw new CoinError("Withdrawal already settled", "STATE");
      return updated.count;
    }
  );
}

/** Admin: credit or debit a wallet by hand, with a note for the ledger. */
export async function adminAdjust(userId: string, delta: number, note: string, key: string) {
  const amount = Math.trunc(delta);
  if (!amount) throw new CoinError("Enter a non-zero amount", "INVALID");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new CoinError("User not found", "NOT_FOUND");
  return move([
    { userId, type: "ADMIN_ADJUST", amount, idempotencyKey: key, source: "admin", note: note.slice(0, 300) },
  ]);
}

export function coinsToNaira(coins: number, koboPerCoin: number) {
  return `₦${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format((coins * koboPerCoin) / 100)}`;
}

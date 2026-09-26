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
    public code: "INSUFFICIENT" | "INVALID" | "NOT_ALLOWED" | "NOT_FOUND" | "STATE" | "CHANGED" | "NOT_ELIGIBLE"
  ) {
    super(message);
  }
}

/** The transaction client handed to interactive transactions on our extended client. */
export type Tx = Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** One coin always costs the buyer this much, whatever the pack. */
export const COIN_PRICE_KOBO = 5_000;

/** Coins v2 catalogue. No bulk discount: every pack is coins x N50. */
export const DEFAULT_PACKS = [
  { name: "Starter", coins: 20 },
  { name: "Bronze", coins: 50 },
  { name: "Silver", coins: 100 },
  { name: "Gold", coins: 250 },
  { name: "Platinum", coins: 500 },
  { name: "Diamond", coins: 1_000 },
  { name: "Royal", coins: 1_500 },
  { name: "VIP", coins: 2_000 },
].map((pack, i) => ({ ...pack, priceKobo: pack.coins * COIN_PRICE_KOBO, sortOrder: i + 1 }));

export async function getCoinSettings() {
  return db.coinSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

/** Seed the default packs the first time the coin store is opened. */
export async function ensureCoinCatalog() {
  const count = await db.coinPack.count();
  if (count === 0) await db.coinPack.createMany({ data: DEFAULT_PACKS });
}

/** The fixed coin price. Stored in settings for the audit trail, but never allowed to drift from N50. */
export function coinPrice(settings: { coinPriceKobo: number }) {
  return settings.coinPriceKobo > 0 ? settings.coinPriceKobo : COIN_PRICE_KOBO;
}

/** Active packs, priced from the coin price rather than whatever is stored on the row. */
export async function activePacks() {
  await ensureCoinCatalog();
  const [packs, settings] = await Promise.all([
    db.coinPack.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }),
    getCoinSettings(),
  ]);
  const price = coinPrice(settings);
  return packs.map((pack) => ({ ...pack, priceKobo: pack.coins * price }));
}

export async function getWallet(userId: string) {
  const wallet = await db.coinWallet.findUnique({ where: { userId } });
  return { balance: wallet?.balance ?? 0, held: wallet?.held ?? 0, lifetimeEarned: wallet?.lifetimeEarned ?? 0 };
}

export async function lockWallets(tx: Tx, userIds: string[]) {
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

export type CoinChange = {
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

export async function applyCoinChange(tx: Tx, change: CoinChange) {
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

export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Run a set of ledger changes atomically. If the first change's idempotency
 * key was already used, nothing happens and the earlier result is reported.
 */
async function move<T>(
  changes: CoinChange[],
  extra?: (tx: Tx) => Promise<T>
): Promise<{ duplicate: boolean; entries: Awaited<ReturnType<typeof applyCoinChange>>[]; extra?: T }> {
  const key = changes[0]?.idempotencyKey;
  if (key) {
    const existing = await db.coinTransaction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { duplicate: true, entries: [existing] };
  }
  try {
    return await db.$transaction(async (tx) => {
      await lockWallets(tx, changes.map((c) => c.userId));
      const entries = [];
      for (const change of changes) entries.push(await applyCoinChange(tx, change));
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

// ---------------------------------------------------------------- legacy payouts

/*
 * Coins v1 let escorts cash out coins directly. v2 pays out of the naira
 * earnings wallet instead (see earnings.ts), but a v1 request that is still
 * open has to be settled the way it was made: by releasing or refunding the
 * coins it holds. These two only ever touch requests with source "coins".
 */

/** Admin: a v1 coin payout was sent. Releases the held coins for good. */
export async function legacyMarkPaid(withdrawalId: string, payoutReference: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.source !== "coins") throw new CoinError("Not a coin withdrawal", "STATE");
  if (w.status === "PAID") return w;
  if (w.status === "REJECTED") throw new CoinError("This withdrawal was rejected", "STATE");
  return move(
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
}

/** Admin: refuse a v1 coin payout and give the coins back. */
export async function legacyReject(withdrawalId: string, note: string) {
  const w = await db.coinWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new CoinError("Withdrawal not found", "NOT_FOUND");
  if (w.source !== "coins") throw new CoinError("Not a coin withdrawal", "STATE");
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

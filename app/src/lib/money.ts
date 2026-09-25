import { db } from "./db";

export function nairaFromKobo(kobo: number) {
  return `₦${new Intl.NumberFormat("en-NG").format(Math.max(0, Math.round(kobo / 100)))}`;
}

export async function getSettings() {
  return db.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

// Settling is idempotent, and it runs on every commission read plus the cron
// tick. Coalesce concurrent callers onto one query and skip re-running it
// within a short window so bursts of reads don't each grab a pool connection.
const SETTLE_INTERVAL_MS = 30_000;
let lastSettledAt = 0;
let settling: Promise<void> | null = null;

export async function settleCommissions(force = false) {
  if (settling) return settling;
  if (!force && Date.now() - lastSettledAt < SETTLE_INTERVAL_MS) return;
  settling = (async () => {
    await db.referralEarning.updateMany({
      where: { status: "PENDING", availableAt: { lte: new Date() } },
      data: { status: "AVAILABLE" },
    });
    lastSettledAt = Date.now();
  })().finally(() => {
    settling = null;
  });
  return settling;
}

export function isSubscriptionActive(expiresAt: Date | null | undefined) {
  return !!(expiresAt && expiresAt.getTime() > Date.now());
}

export function isBoostActive(until: Date | null | undefined) {
  return !!(until && until.getTime() > Date.now());
}

export async function availableCommissionKobo(userId: string) {
  await settleCommissions();
  const [earned, held] = await Promise.all([
    db.referralEarning.aggregate({
      where: { referrerId: userId, status: "AVAILABLE" },
      _sum: { amountKobo: true },
    }),
    db.withdrawal.aggregate({
      where: { userId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { amountKobo: true },
    }),
  ]);
  return Math.max(0, (earned._sum.amountKobo ?? 0) - (held._sum.amountKobo ?? 0));
}

export async function pendingCommissionKobo(userId: string) {
  await settleCommissions();
  const pending = await db.referralEarning.aggregate({
    where: { referrerId: userId, status: "PENDING" },
    _sum: { amountKobo: true },
  });
  return pending._sum.amountKobo ?? 0;
}

export async function ensureCatalog() {
  await getSettings();
  const plans = await db.subscriptionPlan.count();
  if (plans === 0) {
    await db.subscriptionPlan.createMany({
      data: [
        { slug: "monthly", name: "Monthly", durationDays: 30, priceKobo: 1_000_000, publicVisible: true, sortOrder: 1 },
        { slug: "quarterly", name: "3 Months", durationDays: 90, priceKobo: 2_500_000, publicVisible: true, sortOrder: 2 },
        { slug: "six_month", name: "6 Months", durationDays: 180, priceKobo: 4_500_000, publicVisible: false, sortOrder: 3 },
      ],
    });
  }
  const boosts = await db.boostProduct.count();
  if (boosts === 0) {
    await db.boostProduct.createMany({
      data: [
        { slug: "boost_7d", name: "7-Day Profile Boost", durationHours: 168, priceKobo: 500_000, publicVisible: true, sortOrder: 1 },
      ],
    });
  }
}

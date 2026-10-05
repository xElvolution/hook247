import { Plan, PaymentStatus, ReportStatus } from "@prisma/client";
import { db } from "@/lib/db";

/** Naira from kobo, for display. */
export const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursAgo(n: number) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - n);
  return d;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}

function later(a: Date, b: Date) {
  return a > b ? a : b;
}

type Bucket = { t: Date; n: number };

function hourKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function fillHours(rows: Bucket[], hours: number) {
  const map = new Map(rows.map((r) => [hourKey(r.t), r.n]));
  return Array.from({ length: hours }, (_, i) => {
    const d = hoursAgo(hours - 1 - i);
    return {
      label: d.toLocaleString("en-NG", { hour: "2-digit", minute: "2-digit" }),
      value: map.get(hourKey(d)) ?? 0,
    };
  });
}

function fillDays(rows: Bucket[], days: number) {
  const map = new Map(rows.map((r) => [r.t.toISOString().slice(0, 10), r.n]));
  return Array.from({ length: days }, (_, i) => {
    const d = daysAgo(days - 1 - i);
    return {
      label: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      value: map.get(d.toISOString().slice(0, 10)) ?? 0,
    };
  });
}

function fillMonths(rows: Bucket[], months: number) {
  const map = new Map(rows.map((r) => [`${r.t.getFullYear()}-${r.t.getMonth()}`, r.n]));
  return Array.from({ length: months }, (_, i) => {
    const d = monthsAgo(months - 1 - i);
    return {
      label: d.toLocaleDateString("en-NG", { month: "short", year: "numeric" }),
      value: map.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    };
  });
}

async function paidSince() {
  const settings = await db.platformSettings.findUnique({ where: { id: "default" } });
  return settings?.revenueResetAt ?? new Date(0);
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;

/**
 * Every headline number for the dashboard, in one round trip. These run
 * concurrently because none of them depends on another.
 */
export async function getOverview() {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const since24h = hoursAgo(23);
  const sinceYear = monthsAgo(11);
  const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const resetAt = await paidSince();
  const payFrom = later(resetAt, sinceYear);

  const [
    users,
    newUsers7,
    newUsers30,
    banned,
    verifiedUsers,
    profiles,
    live,
    verified,
    plusCount,
    eliteCount,
    matches,
    messages,
    posts,
    hiddenPosts,
    openReports,
    activeToday,
    revenueAll,
    revenue30,
    pendingPayments,
    failedPayments,
    signupHour,
    signupWeek,
    signupMonth,
    signupYear,
    revenueHour,
    revenueWeek,
    revenueMonth,
    revenueYear,
    recentActions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since7 } } }),
    db.user.count({ where: { createdAt: { gte: since30 } } }),
    db.user.count({ where: { bannedAt: { not: null } } }),
    db.user.count({ where: { emailVerified: true } }),
    db.profile.count(),
    db.profile.count({ where: { isLive: true } }),
    db.profile.count({ where: { verified: true } }),
    db.profile.count({ where: { plan: Plan.PLUS } }),
    db.profile.count({ where: { plan: Plan.ELITE } }),
    db.match.count(),
    db.message.count(),
    db.post.count(),
    db.post.count({ where: { hiddenAt: { not: null } } }),
    db.report.count({ where: { status: ReportStatus.OPEN } }),
    db.profile.count({ where: { lastActive: { gte: activeSince } } }),
    db.payment.aggregate({
      _sum: { amountKobo: true },
      where: { status: PaymentStatus.SUCCESS, createdAt: { gte: resetAt } },
    }),
    db.payment.aggregate({
      _sum: { amountKobo: true },
      where: { status: PaymentStatus.SUCCESS, createdAt: { gte: later(resetAt, since30) } },
    }),
    db.payment.count({ where: { status: PaymentStatus.PENDING } }),
    db.payment.count({ where: { status: PaymentStatus.FAILED } }),
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('hour', "createdAt") AS day, COUNT(*) AS n
      FROM "User" WHERE "createdAt" >= ${since24h}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
      FROM "User" WHERE "createdAt" >= ${since7}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
      FROM "User" WHERE "createdAt" >= ${since30}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS day, COUNT(*) AS n
      FROM "User" WHERE "createdAt" >= ${sinceYear}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; kobo: bigint }[]>`
      SELECT date_trunc('hour', "createdAt") AS day, SUM("amountKobo") AS kobo
      FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${later(resetAt, since24h)}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; kobo: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, SUM("amountKobo") AS kobo
      FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${later(resetAt, since7)}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; kobo: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, SUM("amountKobo") AS kobo
      FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${later(resetAt, since30)}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; kobo: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS day, SUM("amountKobo") AS kobo
      FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${payFrom}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const swipes = await db.swipe.count();
  const likes = await db.swipe.count({ where: { liked: true } });

  return {
    users,
    newUsers7,
    newUsers30,
    banned,
    verifiedUsers,
    profiles,
    live,
    verified,
    plusCount,
    eliteCount,
    freeCount: profiles - plusCount - eliteCount,
    matches,
    messages,
    posts,
    hiddenPosts,
    openReports,
    activeToday,
    revenueAllKobo: revenueAll._sum.amountKobo ?? 0,
    revenue30Kobo: revenue30._sum.amountKobo ?? 0,
    pendingPayments,
    failedPayments,
    swipes,
    // Share of right-swipes that became mutual. Guarded against divide-by-zero
    // on a fresh database.
    matchRate: likes > 0 ? (matches * 2) / likes : 0,
    signupChart: {
      day: fillHours(signupHour.map((r) => ({ t: new Date(r.day), n: Number(r.n) })), 24),
      week: fillDays(signupWeek.map((r) => ({ t: new Date(r.day), n: Number(r.n) })), 7),
      month: fillDays(signupMonth.map((r) => ({ t: new Date(r.day), n: Number(r.n) })), 30),
      year: fillMonths(signupYear.map((r) => ({ t: new Date(r.day), n: Number(r.n) })), 12),
    },
    revenueChart: {
      day: fillHours(revenueHour.map((r) => ({ t: new Date(r.day), n: Number(r.kobo) })), 24),
      week: fillDays(revenueWeek.map((r) => ({ t: new Date(r.day), n: Number(r.kobo) })), 7),
      month: fillDays(revenueMonth.map((r) => ({ t: new Date(r.day), n: Number(r.kobo) })), 30),
      year: fillMonths(revenueYear.map((r) => ({ t: new Date(r.day), n: Number(r.kobo) })), 12),
    },
    recentActions,
  };
}

export { paidSince };

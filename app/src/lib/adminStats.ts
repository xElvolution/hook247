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

export type Overview = Awaited<ReturnType<typeof getOverview>>;

/**
 * Every headline number for the dashboard, in one round trip. These run
 * concurrently because none of them depends on another.
 */
export async function getOverview() {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
    signupSeries,
    revenueSeries,
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
      where: { status: PaymentStatus.SUCCESS },
    }),
    db.payment.aggregate({
      _sum: { amountKobo: true },
      where: { status: PaymentStatus.SUCCESS, createdAt: { gte: since30 } },
    }),
    db.payment.count({ where: { status: PaymentStatus.PENDING } }),
    db.payment.count({ where: { status: PaymentStatus.FAILED } }),
    // Grouped in SQL rather than pulling every row back and counting in JS.
    db.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
      FROM "User" WHERE "createdAt" >= ${since30}
      GROUP BY 1 ORDER BY 1 ASC`,
    db.$queryRaw<{ day: Date; kobo: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, SUM("amountKobo") AS kobo
      FROM "Payment" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${since30}
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
    signupSeries: signupSeries.map((r) => ({
      day: r.day,
      n: Number(r.n),
    })),
    revenueSeries: revenueSeries.map((r) => ({
      day: r.day,
      kobo: Number(r.kobo),
    })),
    recentActions,
  };
}

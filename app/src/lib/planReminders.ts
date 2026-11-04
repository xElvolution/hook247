import { db } from "@/lib/db";
import { mailConfigured, sendPlanReminderEmail, type PlanReminderKind } from "@/lib/mailer";

const DAY = 24 * 3600 * 1000;
const LAGOS_OFFSET = 3600 * 1000; // Africa/Lagos is UTC+1 all year (no DST).
const KIND_BY_DAYS: Record<number, PlanReminderKind> = { 3: "d3", 1: "d1", 0: "d0" };
const PLAN_LABEL: Record<string, string> = { PLUS: "Plus", ELITE: "Elite" };

/** Whole Lagos calendar days between now and the expiry (0 = expires today). */
export function lagosDaysLeft(expiresAt: Date, now = new Date()) {
  const day = (d: Date) => Math.floor((d.getTime() + LAGOS_OFFSET) / DAY);
  return day(expiresAt) - day(now);
}

export async function planRemindersEnabled() {
  const row = await db.platformSettings.findUnique({ where: { id: "default" }, select: { planRemindersEnabled: true } });
  return row?.planRemindersEnabled ?? true;
}

/**
 * Sends due plan-expiry reminders. Safe to call every cron tick: each
 * (member, expiry, kind) is claimed with a unique row before sending, so a
 * reminder goes out at most once. Mail only goes out 08:00-21:00 Lagos time.
 */
export async function sendPlanReminders(now = new Date()) {
  if (!mailConfigured() || !(await planRemindersEnabled())) return { sent: 0, skipped: "off" as const };
  const lagosHour = new Date(now.getTime() + LAGOS_OFFSET).getUTCHours();
  if (lagosHour < 8 || lagosHour >= 21) return { sent: 0, skipped: "quiet-hours" as const };

  const dayStart = new Date(Math.floor((now.getTime() + LAGOS_OFFSET) / DAY) * DAY - LAGOS_OFFSET);
  const profiles = await db.profile.findMany({
    where: {
      plan: { not: "FREE" },
      subscriptionExpiresAt: { gte: now, lt: new Date(dayStart.getTime() + 4 * DAY) },
    },
    select: { userId: true, plan: true, subscriptionExpiresAt: true, user: { select: { email: true } } },
    take: 500,
  });

  let sent = 0;
  for (const p of profiles) {
    const expiresAt = p.subscriptionExpiresAt!;
    const kind = KIND_BY_DAYS[lagosDaysLeft(expiresAt, now)];
    if (!kind || !p.user?.email) continue;
    // Claim first; a duplicate (already sent) inserts nothing.
    const claim = await db.planReminder.createMany({ data: [{ userId: p.userId, expiresAt, kind }], skipDuplicates: true });
    if (claim.count === 0) continue;
    try {
      await sendPlanReminderEmail(p.user.email, kind, PLAN_LABEL[p.plan] ?? p.plan, expiresAt);
      sent++;
    } catch (err) {
      console.error("plan reminder", err);
      // Release the claim so the next tick retries.
      await db.planReminder.deleteMany({ where: { userId: p.userId, expiresAt, kind } }).catch(() => undefined);
    }
  }
  return { sent };
}

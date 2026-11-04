import { randomBytes } from "node:crypto";
import { db } from "./db";
import { sendBonusEmail } from "./mailer";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://flirta247.com").replace(/\/$/, "");
}

export async function offerBonus(input: {
  userId: string;
  email: string;
  kind: "plan" | "boost";
  days: number;
  hours: number;
  planSlug: string;
  label: string;
}) {
  const profile = await db.profile.findUnique({ where: { userId: input.userId }, select: { id: true } });
  if (!profile) return { ok: false as const, error: "This account has no profile yet." };
  const token = randomBytes(24).toString("hex");
  await db.bonusClaim.create({
    data: {
      token,
      userId: input.userId,
      kind: input.kind,
      days: input.days,
      hours: input.hours,
      planSlug: input.planSlug,
      label: input.label,
    },
  });
  try {
    await sendBonusEmail(input.email, input.label, `${appOrigin()}/claim/${token}`);
  } catch (err) {
    console.error("Bonus email failed:", (err as Error).message);
    return { ok: false as const, error: "The bonus was saved, but the email could not be sent." };
  }
  return { ok: true as const };
}

export async function claimBonus(token: string, userId: string) {
  const claim = await db.bonusClaim.findUnique({ where: { token } });
  if (!claim) return { ok: false as const, error: "This claim link is not valid." };
  if (claim.userId !== userId) return { ok: false as const, error: "Sign in with the account that received this bonus." };
  if (claim.claimedAt) return { ok: true as const, already: true, label: claim.label };

  const taken = await db.bonusClaim.updateMany({
    where: { id: claim.id, claimedAt: null },
    data: { claimedAt: new Date() },
  });
  if (taken.count === 0) return { ok: true as const, already: true, label: claim.label };

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) {
    await db.bonusClaim.update({ where: { id: claim.id }, data: { claimedAt: null } });
    return { ok: false as const, error: "Finish your profile before claiming this bonus." };
  }

  const now = new Date();
  if (claim.kind === "boost") {
    const base = profile.boostedUntil && profile.boostedUntil > now ? profile.boostedUntil : now;
    const until = new Date(base.getTime() + Math.max(1, claim.hours) * 60 * 60 * 1000);
    await db.profile.update({
      where: { userId },
      data: { boostedAt: now, boostedUntil: until, adminHidden: false },
    });
  } else {
    const days = Math.max(1, claim.days);
    const base = profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > now ? profile.subscriptionExpiresAt : now;
    const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await db.profile.update({
      where: { userId },
      data: {
        plan: days >= 90 ? "ELITE" : "PLUS",
        subscriptionExpiresAt: expires,
        subscriptionPlanSlug: claim.planSlug || (days >= 90 ? "quarterly" : "monthly"),
        adminHidden: false,
      },
    });
  }
  return { ok: true as const, already: false, label: claim.label };
}

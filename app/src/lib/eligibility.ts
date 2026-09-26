import type { Plan } from "@prisma/client";
import { db } from "./db";

/**
 * Earning on Hooks247 (going live, receiving gifts, withdrawing) needs an
 * active paid plan. "Active" follows the same rule as the rest of the app: a
 * paid plan whose subscription has not run out yet.
 */
export function hasActivePaidPlan(profile: { plan: Plan; subscriptionExpiresAt: Date | null } | null | undefined) {
  if (!profile || profile.plan === "FREE") return false;
  return Boolean(profile.subscriptionExpiresAt && profile.subscriptionExpiresAt.getTime() > Date.now());
}

export type EarnerStatus = {
  isEscort: boolean;
  paid: boolean;
  planExpiresAt: Date | null;
  giftingDisabled: boolean;
  payoutsFrozen: boolean;
  blocked: boolean;
};

/** Everything that decides whether a member can go live, receive gifts or withdraw. */
export async function earnerStatus(userId: string): Promise<EarnerStatus | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      bannedAt: true,
      suspendedUntil: true,
      giftingDisabled: true,
      payoutsFrozen: true,
      profile: { select: { role: true, plan: true, subscriptionExpiresAt: true } },
    },
  });
  if (!user) return null;
  return {
    isEscort: user.profile?.role === "ESCORT",
    paid: hasActivePaidPlan(user.profile),
    planExpiresAt: user.profile?.subscriptionExpiresAt ?? null,
    giftingDisabled: user.giftingDisabled,
    payoutsFrozen: user.payoutsFrozen,
    blocked: Boolean(user.bannedAt || (user.suspendedUntil && user.suspendedUntil > new Date())),
  };
}

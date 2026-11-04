"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { recordFacePass } from "@/lib/welcome";

function back() {
  revalidatePath("/502test/campaign");
}

export async function saveWelcomeCampaign(form: FormData) {
  await requireAdmin();
  const participantLimit = Math.floor(Number(form.get("participantLimit")));
  const rewardNaira = Math.floor(Number(String(form.get("rewardNaira") ?? "").replace(/[^\d]/g, "")));
  const requiredReferrals = Math.floor(Number(form.get("requiredReferrals")));
  const enabled = form.get("enabled") === "on";
  if (participantLimit < 1 || participantLimit > 100000) return;
  if (rewardNaira < 1 || rewardNaira > 10_000_000) return;
  if (requiredReferrals < 1 || requiredReferrals > 100) return;
  await db.welcomeCampaign.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled,
      participantLimit,
      rewardKobo: rewardNaira * 100,
      requiredReferrals,
    },
    update: {
      enabled,
      participantLimit,
      rewardKobo: rewardNaira * 100,
      requiredReferrals,
    },
  });
  await logAdminAction("welcome.settings", "campaign", "default", `enabled ${enabled}, limit ${participantLimit}, reward ${rewardNaira}, referrals ${requiredReferrals}`);
  back();
}

export async function setWelcomeReferral(form: FormData) {
  await requireAdmin();
  const referrerId = String(form.get("referrerId") ?? "");
  const referredId = String(form.get("referredId") ?? "");
  const rejected = String(form.get("rejected") ?? "") === "1";
  const note = String(form.get("note") ?? "").slice(0, 300);
  if (!referrerId || !referredId) return;
  await db.welcomeReferralFlag.upsert({
    where: { referredId },
    create: { referrerId, referredId, rejected, note },
    update: { rejected, note },
  });
  const { syncWelcome } = await import("@/lib/welcome");
  await syncWelcome(referredId);
  await logAdminAction(rejected ? "welcome.referral.reject" : "welcome.referral.allow", "user", referredId, note);
  back();
}

export async function voidWelcomeReward(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (!userId) return;
  await db.welcomeReward.updateMany({
    where: { userId, status: { not: "WITHDRAWN" } },
    data: { status: "VOID" },
  });
  await logAdminAction("welcome.void", "user", userId, "");
  back();
}

export async function markIdentityPassed(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (!userId) return;
  await recordFacePass(userId);
  await logAdminAction("welcome.identity.pass", "user", userId, "admin recorded face verification");
  back();
}

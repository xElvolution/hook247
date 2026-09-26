"use server";

import { revalidatePath } from "next/cache";
import {
  Plan,
  ReportStatus,
  VerificationSource,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { fulfilPayment } from "@/lib/fulfilPayment";

/**
 * Every action re-checks authorization itself. The proxy is a perimeter, not a
 * guarantee — Server Functions are POSTs to the page they live on, so a matcher
 * change could remove proxy coverage without touching this file.
 */

export async function banUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  if (!userId) return;

  await db.user.update({
    where: { id: userId },
    data: { bannedAt: new Date(), banReason: reason },
  });
  // Take the banned account out of circulation immediately rather than waiting
  // for the next feed query to filter it.
  await db.profile.updateMany({
    where: { userId },
    data: { isLive: false, availableToday: false },
  });

  await logAdminAction("user.ban", "user", userId, reason);
  revalidateUser(userId);
}

export async function unbanUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await db.user.update({
    where: { id: userId },
    data: { bannedAt: null, banReason: "", suspendedUntil: null },
  });
  await logAdminAction("user.unban", "user", userId);
  revalidateUser(userId);
}

export async function suspendUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const days = Number(formData.get("days") ?? 0);
  if (!userId || !Number.isFinite(days) || days <= 0) return;

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.user.update({
    where: { id: userId },
    data: { suspendedUntil: until },
  });
  await db.profile.updateMany({
    where: { userId },
    data: { isLive: false, availableToday: false },
  });
  await logAdminAction("user.suspend", "user", userId, `${days}d`);
  revalidateUser(userId);
}

/** Stop (or allow again) gifts to and from this account. */
export async function setGiftingDisabled(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const disabled = formData.get("disabled") === "1";
  if (!userId) return;
  await db.user.update({ where: { id: userId }, data: { giftingDisabled: disabled } });
  await logAdminAction(disabled ? "user.gifting.disable" : "user.gifting.enable", "user", userId);
  revalidateUser(userId);
}

/** Hold every withdrawal for this account until an admin lifts it. */
export async function setPayoutsFrozen(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const frozen = formData.get("frozen") === "1";
  if (!userId) return;
  await db.user.update({ where: { id: userId }, data: { payoutsFrozen: frozen } });
  await logAdminAction(frozen ? "user.payouts.freeze" : "user.payouts.unfreeze", "user", userId);
  revalidateUser(userId);
}

export async function hidePost(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  if (!postId) return;

  await db.post.update({
    where: { id: postId },
    data: { hiddenAt: new Date(), hideReason: reason },
  });
  await logAdminAction("post.hide", "post", postId, reason);
  revalidatePath("/502test/content");
  revalidatePath("/502test/reports");
}

export async function unhidePost(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return;

  await db.post.update({
    where: { id: postId },
    data: { hiddenAt: null, hideReason: "" },
  });
  await logAdminAction("post.unhide", "post", postId);
  revalidatePath("/502test/content");
  revalidatePath("/502test/reports");
}

/**
 * Remove a post for good, including its uploaded media on disk. Reports that
 * pointed at it keep their row (and the reason) for the audit trail.
 */
export async function deletePost(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  if (!postId) return;

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { imageUrl: true, videoUrl: true, authorId: true },
  });
  if (!post) return;
  await db.post.delete({ where: { id: postId } });

  const { unlink } = await import("node:fs/promises");
  const path = await import("node:path");
  for (const url of [post.imageUrl, post.videoUrl]) {
    if (!url.startsWith("/uploads/")) continue;
    const name = path.basename(url);
    await unlink(path.join(process.cwd(), "public", "uploads", name)).catch(() => undefined);
  }

  await logAdminAction("post.delete", "post", postId, reason || `author ${post.authorId}`);
  revalidatePath("/502test/content");
  revalidatePath("/502test/reports");
}

export async function resolveReport(formData: FormData) {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  const resolution = String(formData.get("resolution") ?? "").slice(0, 500);
  if (!reportId) return;

  // Only accept the two terminal states from the form; anything else is a
  // crafted payload rather than a button on the page.
  if (status !== ReportStatus.RESOLVED && status !== ReportStatus.DISMISSED) {
    return;
  }

  await db.report.update({
    where: { id: reportId },
    data: { status, resolution, resolvedAt: new Date() },
  });
  await logAdminAction(`report.${status.toLowerCase()}`, "report", reportId, resolution);
  revalidatePath("/502test/reports");
}

export async function approveVerification(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  if (!userId) return;

  await db.profile.update({
    where: { userId },
    data: {
      verified: true,
      verifiedSource: VerificationSource.REVIEWED,
      verifiedAt: new Date(),
      verifyNote: note,
    },
  });
  await logAdminAction("verification.approve", "user", userId, note);
  revalidateUser(userId);
}

export async function revokeVerification(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  if (!userId) return;

  await db.profile.update({
    where: { userId },
    data: {
      verified: false,
      verifiedSource: VerificationSource.NONE,
      verifiedAt: null,
      verifyNote: note,
    },
  });
  await logAdminAction("verification.revoke", "user", userId, note);
  revalidateUser(userId);
}

export async function setPlan(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!userId) return;
  if (plan !== Plan.FREE && plan !== Plan.PLUS && plan !== Plan.ELITE) return;

  await db.profile.update({ where: { userId }, data: { plan } });
  await logAdminAction("user.setplan", "user", userId, plan);
  revalidateUser(userId);
}

/**
 * Re-run fulfilment for a payment that Paystack took but the app never applied
 * — the usual cause is a webhook that never arrived. Safe to press twice:
 * fulfilPayment claims the row atomically and grants the benefit exactly once.
 */
export async function retryPayment(formData: FormData) {
  await requireAdmin();
  const reference = String(formData.get("reference") ?? "");
  if (!reference) return;

  const result = await fulfilPayment(reference);
  await logAdminAction(
    "payment.retry",
    "payment",
    reference,
    result.ok ? result.state : `${result.state}: ${result.error}`
  );
  revalidatePath("/502test/payments");
}

function revalidateUser(userId: string) {
  revalidatePath("/502test/users");
  revalidatePath(`/502test/users/${userId}`);
  revalidatePath("/502test/profiles");
  revalidatePath("/502test/verification");
  revalidatePath("/");
}

function revalidateProfiles() {
  revalidatePath("/502test/users");
  revalidatePath("/502test/profiles");
  revalidatePath("/502test/verification");
  revalidatePath("/");
}

export async function grantSubscription(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const days = Math.max(1, Math.min(365, Number(formData.get("days") ?? 30) || 30));
  if (!userId) return;

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;

  const now = new Date();
  const base =
    profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > now
      ? profile.subscriptionExpiresAt
      : now;
  const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await db.profile.update({
    where: { userId },
    data: {
      plan: days >= 90 ? "ELITE" : "PLUS",
      subscriptionExpiresAt: expires,
      subscriptionPlanSlug: days >= 90 ? "quarterly" : "monthly",
      adminHidden: false,
    },
  });
  await logAdminAction("user.grant", "user", userId, `${days}d`);
  revalidateUser(userId);
}

export async function grantBoost(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const hours = Math.max(1, Math.min(24 * 60, Number(formData.get("hours") ?? 168) || 168));
  if (!userId) return;

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;

  const now = new Date();
  const base = profile.boostedUntil && profile.boostedUntil > now ? profile.boostedUntil : now;
  const until = new Date(base.getTime() + hours * 60 * 60 * 1000);
  await db.profile.update({
    where: { userId },
    data: { boostedAt: now, boostedUntil: until, adminHidden: false },
  });
  await logAdminAction("user.boost", "user", userId, `${hours}h`);
  revalidateUser(userId);
}

export async function hideProfile(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await db.profile.update({
    where: { userId },
    data: { adminHidden: true, isLive: false, availableToday: false },
  });
  await logAdminAction("user.hide", "user", userId);
  revalidateUser(userId);
}

export async function showProfile(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await db.profile.update({
    where: { userId },
    data: { adminHidden: false },
  });
  await logAdminAction("user.show", "user", userId);
  revalidateUser(userId);
}

export async function setLive(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const live = String(formData.get("live") ?? "") === "1";
  if (!userId) return;
  await db.profile.update({
    where: { userId },
    data: { isLive: live },
  });
  await logAdminAction(live ? "user.live.on" : "user.live.off", "user", userId);
  revalidateUser(userId);
}

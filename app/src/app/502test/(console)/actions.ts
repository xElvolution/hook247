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
  revalidatePath("/502test/users");
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
  revalidatePath("/502test/users");
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
  revalidatePath("/502test/users");
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
  revalidatePath("/502test/verification");
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
  revalidatePath("/502test/verification");
}

export async function setPlan(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!userId) return;
  if (plan !== Plan.FREE && plan !== Plan.PLUS && plan !== Plan.ELITE) return;

  await db.profile.update({ where: { userId }, data: { plan } });
  await logAdminAction("user.setplan", "user", userId, plan);
  revalidatePath("/502test/users");
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

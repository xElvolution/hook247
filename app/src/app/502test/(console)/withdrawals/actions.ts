"use server";

import { revalidatePath } from "next/cache";
import { WithdrawalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";

export async function setWithdrawal(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as WithdrawalStatus;
  const adminNote = String(form.get("adminNote") ?? "").slice(0, 500);
  if (!id || !["APPROVED", "REJECTED", "PAID"].includes(status)) return;

  await db.withdrawal.update({
    where: { id },
    data: { status, adminNote, resolvedAt: new Date() },
  });
  await logAdminAction("withdrawal.update", "withdrawal", id, status);
  revalidatePath("/502test/withdrawals");
}

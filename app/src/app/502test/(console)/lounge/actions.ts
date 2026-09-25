"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";

export async function setLoungeHidden(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const hide = formData.get("hide") === "1";
  const msg = await db.loungeMessage.update({ where: { id }, data: { hiddenAt: hide ? new Date() : null } });
  await logAdminAction(hide ? "lounge.hide" : "lounge.restore", "loungeMessage", id, msg.body.slice(0, 120));
  revalidatePath("/502test/lounge");
}

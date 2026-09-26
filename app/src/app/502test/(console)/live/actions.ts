"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { endLive } from "@/lib/live";

function back(message: string, tone: "ok" | "error" = "ok"): never {
  redirect(`/502test/live?${tone}=${encodeURIComponent(message)}`);
}

export async function forceEndLive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const session = await db.liveSession.findUnique({ where: { id }, select: { status: true, title: true } });
  if (!session) back("Live not found", "error");
  if (session.status === "LIVE") await endLive(id, "admin_ended");
  await logAdminAction("live.end", "liveSession", id, session.title);
  revalidatePath("/502test/live");
  back("Live ended");
}

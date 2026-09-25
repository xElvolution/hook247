"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { endLive } from "@/lib/live";

function back(message: string, tone: "ok" | "error" = "ok"): never {
  redirect(`/502test/live?${tone}=${encodeURIComponent(message)}`);
}

export async function saveGift(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 16);
  const coins = Math.floor(Number(formData.get("coins")));
  const sortOrder = Math.floor(Number(formData.get("sortOrder") ?? 0)) || 0;
  const active = formData.get("active") === "on";
  if (!name || !emoji) back("Gift needs a name and an emoji", "error");
  if (!Number.isFinite(coins) || coins < 1 || coins > 100_000) back("Gift price must be between 1 and 100,000 coins", "error");

  if (id) {
    await db.liveGift.update({ where: { id }, data: { name, emoji, coins, sortOrder, active } });
  } else {
    await db.liveGift.create({ data: { name, emoji, coins, sortOrder, active } });
  }
  await logAdminAction("live.gift", "liveGift", id || name, `${emoji} ${name} ${coins} coins ${active ? "active" : "inactive"}`);
  revalidatePath("/502test/live");
  back(`${name} saved`);
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

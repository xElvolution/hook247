"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { GIFT_ANIMATIONS } from "@/lib/live";

function back(message: string, tone: "ok" | "error" = "ok"): never {
  redirect(`/502test/gifts?${tone}=${encodeURIComponent(message)}`);
}

export async function saveGift(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 16);
  const coins = Math.floor(Number(formData.get("coins")));
  const sortOrder = Math.floor(Number(formData.get("sortOrder") ?? 0)) || 0;
  const animationRaw = String(formData.get("animation") ?? "float");
  const animation = (GIFT_ANIMATIONS as readonly string[]).includes(animationRaw) ? animationRaw : "float";
  const active = formData.get("active") === "on";
  if (!name || !emoji) back("Gift needs a name and an emoji", "error");
  if (!Number.isFinite(coins) || coins < 1 || coins > 100_000) back("Gift value must be between 1 and 100,000 coins", "error");

  if (id) {
    await db.liveGift.update({ where: { id }, data: { name, emoji, coins, sortOrder, active, animation } });
  } else {
    await db.liveGift.create({ data: { name, emoji, coins, sortOrder, active, animation } });
  }
  await logAdminAction("live.gift", "liveGift", id || name, `${emoji} ${name} ${coins} coins ${animation} ${active ? "active" : "disabled"}`);
  revalidatePath("/502test/gifts");
  back(`${name} saved`);
}

/** Gifts already sent stay on record, so those are hidden rather than erased. */
export async function deleteGift(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const gift = await db.liveGift.findUnique({ where: { id } });
  if (!gift) back("Gift not found", "error");
  const used = await db.ledgerEntry.count({ where: { giftId: id } });
  if (used) {
    await db.liveGift.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  } else {
    await db.liveGift.delete({ where: { id } });
  }
  await logAdminAction("live.gift.delete", "liveGift", id, `${gift.name}${used ? " (archived, has history)" : ""}`);
  revalidatePath("/502test/gifts");
  back(used ? `${gift.name} removed from the catalog. Its history is kept.` : `${gift.name} deleted`);
}

export async function restoreGift(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const gift = await db.liveGift.update({ where: { id }, data: { deletedAt: null, active: false } });
  await logAdminAction("live.gift.restore", "liveGift", id, gift.name);
  revalidatePath("/502test/gifts");
  back(`${gift.name} restored as disabled. Tick Active to offer it again.`);
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";
import { ensureCatalog } from "@/lib/money";

function n(form: FormData, key: string) {
  return Number(String(form.get(key) ?? "0"));
}

function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function revalidate() {
  revalidatePath("/502test/commerce");
  revalidatePath("/premium");
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  await ensureCatalog();
  await db.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {
      commissionPct1: n(form, "commissionPct1"),
      commissionPct2: n(form, "commissionPct2"),
      commissionPct3: n(form, "commissionPct3"),
      qualifyingPayments: Math.max(1, n(form, "qualifyingPayments")),
      minWithdrawalKobo: Math.max(0, n(form, "minWithdrawalNaira") * 100),
      holdHours: Math.max(0, n(form, "holdHours")),
    },
  });
  await logAdminAction("settings.update", "settings", "default");
  revalidate();
}

export async function savePlan(form: FormData) {
  await requireAdmin();
  const id = s(form, "id");
  const data = {
    name: s(form, "name"),
    durationDays: n(form, "durationDays"),
    priceKobo: n(form, "priceNaira") * 100,
    active: s(form, "active") === "on",
    publicVisible: s(form, "publicVisible") === "on",
  };
  if (id) {
    await db.subscriptionPlan.update({ where: { id }, data });
  } else {
    await db.subscriptionPlan.create({
      data: {
        ...data,
        slug: s(form, "slug") || `plan_${Date.now()}`,
        sortOrder: n(form, "sortOrder"),
      },
    });
  }
  await logAdminAction("plan.save", "plan", id || "new");
  revalidate();
}

export async function saveBoost(form: FormData) {
  await requireAdmin();
  const id = s(form, "id");
  const data = {
    name: s(form, "name"),
    durationHours: n(form, "durationHours"),
    priceKobo: n(form, "priceNaira") * 100,
    active: s(form, "active") === "on",
    publicVisible: s(form, "publicVisible") === "on",
  };
  if (id) {
    await db.boostProduct.update({ where: { id }, data });
  } else {
    await db.boostProduct.create({
      data: {
        ...data,
        slug: s(form, "slug") || `boost_${Date.now()}`,
        sortOrder: n(form, "sortOrder"),
      },
    });
  }
  await logAdminAction("boost.save", "boost", id || "new");
  revalidate();
}

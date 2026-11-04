"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/lib/adminSession";

export async function setFeaturedShowAll(form: FormData) {
  await requireAdmin();
  const on = String(form.get("on") ?? "") === "1";
  await db.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", featuredShowAll: on },
    update: { featuredShowAll: on },
  });
  await logAdminAction(on ? "featured_all_on" : "featured_all_off", "settings", "featuredShowAll");
  revalidatePath("/502test/profiles");
  revalidatePath("/");
}

export async function setFeedShowAnyWithMedia(form: FormData) {
  await requireAdmin();
  const on = String(form.get("on") ?? "") === "1";
  await db.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", feedShowAnyWithMedia: on },
    update: { feedShowAnyWithMedia: on },
  });
  await logAdminAction(on ? "feed_any_media_on" : "feed_any_media_off", "settings", "feedShowAnyWithMedia");
  revalidatePath("/502test/profiles");
  revalidatePath("/");
}

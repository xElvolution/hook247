"use server";

import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { claimBonus } from "@/lib/bonusClaim";

export async function claimBonusAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/claim/${encodeURIComponent(token)}`);
  const result = await claimBonus(token, userId);
  const q = result.ok
    ? `ok=${encodeURIComponent(result.already ? "Already claimed" : "Bonus added")}`
    : `error=${encodeURIComponent(result.error)}`;
  redirect(`/claim/${encodeURIComponent(token)}?${q}`);
}

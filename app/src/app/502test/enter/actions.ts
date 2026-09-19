"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInAdmin, signOutAdmin } from "@/lib/adminSession";

/** Best-effort client IP for rate limiting, trusting the proxy chain's first hop. */
async function clientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function enterAction(_prev: string | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const ok = await signInAdmin(password, await clientIp());

  // One message for wrong password and for rate limiting alike — distinguishing
  // them would tell an attacker when to back off and retry.
  if (!ok) return "Unable to verify.";

  redirect("/502test");
}

export async function leaveAction() {
  await signOutAdmin();
  redirect("/");
}

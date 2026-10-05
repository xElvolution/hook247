import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoungeRoom from "@/components/LoungeRoom";
import { getActiveSessionUserId } from "@/lib/user";

export const metadata: Metadata = { title: "Lounge | Flirta247" };

export default async function LoungePage() {
  const userId = await getActiveSessionUserId();
  if (!userId) redirect("/login?next=/lounge");
  return <LoungeRoom />;
}

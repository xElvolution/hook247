import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";

export async function POST() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  await db.user.update({ where: { id: userId }, data: { rewardPillDismissedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

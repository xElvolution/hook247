import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { realtimeEnabled, realtimePublicUrl, realtimeToken } from "@/lib/realtime";

export async function POST() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isMockUserId(userId) || !realtimeEnabled()) return NextResponse.json({ error: "Realtime unavailable" }, { status: 403 });
  return NextResponse.json(
    { token: await realtimeToken(userId), url: realtimePublicUrl(), userId },
    { headers: { "cache-control": "no-store" } }
  );
}

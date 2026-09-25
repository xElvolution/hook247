import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";

/** Total unread direct messages, for the navigation badge. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId || isMockUserId(userId)) return NextResponse.json({ total: 0 });
  try {
    const total = await db.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        match: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
    });
    return NextResponse.json({ total }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";

/** Unread direct messages (message requests included) and open requests, for the navigation badge. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId || isMockUserId(userId)) return NextResponse.json({ total: 0 });
  try {
    const mine = { OR: [{ userAId: userId }, { userBId: userId }] };
    const [total, requests] = await Promise.all([
      db.message.count({
        where: {
          senderId: { not: userId },
          readAt: null,
          match: { ...mine, NOT: { status: "DECLINED", requestedById: { not: userId } } },
        },
      }),
      db.match.count({ where: { ...mine, status: "PENDING", requestedById: { not: userId } } }),
    ]);
    return NextResponse.json({ total, requests }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}

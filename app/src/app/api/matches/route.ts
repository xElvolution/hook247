import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { isMockUserId, mockMatches } from "@/lib/mock";
import { failFrom } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json(mockMatches());

  try {
    const matches = await db.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    const unread = matches.length
      ? await db.message.groupBy({
          by: ["matchId"],
          where: { matchId: { in: matches.map((m) => m.id) }, senderId: { not: userId }, readAt: null },
          _count: { _all: true },
        })
      : [];
    const unreadBy = new Map(unread.map((u) => [u.matchId, u._count._all]));

    const items = matches.map((m) => {
      const other = m.userAId === userId ? m.userB : m.userA;
      const p = other.profile;
      const last = m.messages[0];
      return {
        matchId: m.id,
        userId: other.id,
        displayName: p?.displayName ?? "Member",
        age: p ? ageFrom(p.birthDate) : null,
        avatarUrl: p?.avatarUrl ?? "",
        verified: p?.verified ?? false,
        city: p?.city ?? "",
        lastMessage: last
          ? { body: last.body, mine: last.senderId === userId, at: last.createdAt, readAt: last.readAt }
          : null,
        unread: unreadBy.get(m.id) ?? 0,
        matchedAt: m.createdAt,
      };
    });
    items.sort((a, b) => {
      const at = new Date(a.lastMessage?.at ?? a.matchedAt).getTime();
      const bt = new Date(b.lastMessage?.at ?? b.matchedAt).getTime();
      return bt - at;
    });
    return NextResponse.json({ me: userId, matches: items });
  } catch (err) {
    return failFrom(err);
  }
}

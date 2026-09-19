import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { isMockUserId, mockMatches } from "@/lib/mock";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json(mockMatches());

  const matches = await db.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { include: { profile: true } },
      userB: { include: { profile: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    matches: matches.map((m) => {
      const other = m.userAId === userId ? m.userB : m.userA;
      const p = other.profile;
      return {
        matchId: m.id,
        userId: other.id,
        displayName: p?.displayName ?? "Member",
        age: p ? ageFrom(p.birthDate) : null,
        avatarUrl: p?.avatarUrl ?? "",
        verified: p?.verified ?? false,
        city: p?.city ?? "",
        lastMessage: m.messages[0]
          ? {
              body: m.messages[0].body,
              mine: m.messages[0].senderId === userId,
              at: m.messages[0].createdAt,
            }
          : null,
        matchedAt: m.createdAt,
      };
    }),
  });
}

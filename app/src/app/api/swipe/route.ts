import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { follow, SocialError, unfollow } from "@/lib/social";
import { isMockUserId, mockSwipe } from "@/lib/mock";

const schema = z.object({
  targetUserId: z.string(),
  liked: z.boolean(),
});

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { targetUserId, liked } = parsed.data;
  if (targetUserId === userId) {
    return NextResponse.json({ error: "Cannot swipe yourself" }, { status: 400 });
  }
  if (isMockUserId(userId)) {
    return NextResponse.json(mockSwipe(targetUserId, liked));
  }

  // A banned account is out of circulation: it should not be reachable through
  // a stale card still open in someone's browser, and must never match.
  const target = await db.user.findFirst({
    where: { id: targetUserId, bannedAt: null },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Profile not available" }, { status: 404 });
  }

  // A like is now a follow. Following each other opens a conversation.
  if (liked) {
    try {
      const result = await follow(userId, targetUserId);
      return NextResponse.json({ ok: true, following: true, matched: result.newMatch, matchId: result.matchId });
    } catch (err) {
      if (err instanceof SocialError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  }

  await db.swipe.upsert({
    where: { swiperId_swipedId: { swiperId: userId, swipedId: targetUserId } },
    create: { swiperId: userId, swipedId: targetUserId, liked: false },
    update: { liked: false },
  });
  await unfollow(userId, targetUserId);
  return NextResponse.json({ ok: true, following: false, matched: false, matchId: null });
}

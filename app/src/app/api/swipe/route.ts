import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const schema = z.object({
  targetUserId: z.string(),
  liked: z.boolean(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { targetUserId, liked } = parsed.data;
  if (targetUserId === userId) {
    return NextResponse.json({ error: "Cannot swipe yourself" }, { status: 400 });
  }

  await db.swipe.upsert({
    where: { swiperId_swipedId: { swiperId: userId, swipedId: targetUserId } },
    create: { swiperId: userId, swipedId: targetUserId, liked },
    update: { liked },
  });

  let match = null;
  if (liked) {
    const theyLikedMe = await db.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: targetUserId, swipedId: userId } },
    });
    if (theyLikedMe?.liked) {
      const [a, b] = [userId, targetUserId].sort();
      match = await db.match.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        create: { userAId: a, userBId: b },
        update: {},
      });
    }
  }

  return NextResponse.json({ ok: true, matched: !!match, matchId: match?.id ?? null });
}

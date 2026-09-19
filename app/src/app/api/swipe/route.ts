import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { sendMatchEmail } from "@/lib/mailer";
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
      const existing = await db.match.findUnique({
        where: { userAId_userBId: { userAId: a, userBId: b } },
      });
      match = existing ?? (await db.match.create({ data: { userAId: a, userBId: b } }));

      // Only on a brand-new match — re-swiping an existing one must not
      // re-notify both people.
      if (!existing) {
        try {
          const [mine, theirs] = await Promise.all([
            db.profile.findUnique({ where: { userId }, include: { user: true } }),
            db.profile.findUnique({
              where: { userId: targetUserId },
              include: { user: true },
            }),
          ]);
          if (mine && theirs) {
            await Promise.all([
              sendMatchEmail(mine.user.email, theirs.displayName),
              sendMatchEmail(theirs.user.email, mine.displayName),
            ]);
          }
        } catch (err) {
          // The match is already saved; a mail outage must not undo it.
          console.error("Match email failed:", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, matched: !!match, matchId: match?.id ?? null });
}

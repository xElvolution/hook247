import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockUserId, mockLikers } from "@/lib/mock";

// "Who liked you" — premium feature. Free users get the count only.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json(mockLikers());

  const me = await db.profile.findUnique({ where: { userId } });
  if (!me) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const likes = await db.swipe.findMany({
    where: { swipedId: userId, liked: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Exclude people I already swiped on (they're either matched or passed)
  const mySwipes = await db.swipe.findMany({
    where: { swiperId: userId, swipedId: { in: likes.map((l) => l.swiperId) } },
    select: { swipedId: true },
  });
  const handled = new Set(mySwipes.map((s) => s.swipedId));
  const pending = likes.filter((l) => !handled.has(l.swiperId));

  // Resolved before the plan check so a banned admirer inflates neither the
  // teaser count shown to free users nor the list shown to paying ones.
  const profiles = await db.profile.findMany({
    where: {
      AND: [VISIBLE_PROFILE, { userId: { in: pending.map((l) => l.swiperId) } }],
    },
  });

  if (me.plan === "FREE") {
    return NextResponse.json({ locked: true, count: profiles.length, likers: [] });
  }

  return NextResponse.json({
    locked: false,
    count: profiles.length,
    likers: profiles.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      age: ageFrom(p.birthDate),
      avatarUrl: p.avatarUrl,
      city: p.city,
      verified: p.verified,
    })),
  });
}

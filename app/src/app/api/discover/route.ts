import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import type { Prisma } from "@prisma/client";
import { isMockUserId, mockDiscover } from "@/lib/mock";

export async function GET() {
  const userId = await getSessionUserId();
  if (isMockUserId(userId)) {
    return NextResponse.json(mockDiscover());
  }

  let where: Prisma.ProfileWhereInput = VISIBLE_PROFILE;
  if (userId) {
    const me = await db.profile.findUnique({ where: { userId } });
    if (me) {
      const alreadySwiped = await db.swipe.findMany({
        where: { swiperId: userId },
        select: { swipedId: true },
      });
      where = {
        AND: [
          VISIBLE_PROFILE,
          {
            userId: { notIn: [userId, ...alreadySwiped.map((s) => s.swipedId)] },
            gender: { in: me.lookingFor },
            lookingFor: { has: me.gender },
          },
        ],
      };
    }
  }

  const candidates = await db.profile.findMany({
    where,
    include: { services: { where: { enabled: true }, take: 3 } },
    orderBy: [{ boostedAt: { sort: "desc", nulls: "last" } }, { lastActive: "desc" }],
    take: 25,
  });

  return NextResponse.json({
    guest: !userId,
    profiles: candidates.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      age: ageFrom(p.birthDate),
      bio: p.bio,
      city: p.city,
      state: p.state,
      interests: p.interests,
      avatarUrl: p.avatarUrl,
      photos: p.photos,
      verified: p.verified,
      boosted: !!p.boostedAt,
      live: p.isLive,
      services: p.services.map((service) => service.name),
    })),
  });
}

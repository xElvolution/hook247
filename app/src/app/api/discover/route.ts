import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_PROFILES } from "@/lib/demoProfiles";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const userId = await getSessionUserId();

  try {
    let where: Prisma.ProfileWhereInput = {};
    if (userId) {
      const me = await db.profile.findUnique({ where: { userId } });
      if (me) {
        const alreadySwiped = await db.swipe.findMany({
          where: { swiperId: userId },
          select: { swipedId: true },
        });
        where = {
          userId: { notIn: [userId, ...alreadySwiped.map((s) => s.swipedId)] },
          gender: { in: me.lookingFor },
          lookingFor: { has: me.gender },
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
  } catch {
    return NextResponse.json({
      guest: !userId,
      demoMode: true,
      profiles: DEMO_PROFILES.map((profile) => ({
        userId: profile.userId,
        displayName: profile.displayName,
        age: profile.age,
        bio: profile.bio,
        city: profile.city,
        state: profile.state,
        interests: profile.interests,
        avatarUrl: profile.avatarUrl,
        photos: profile.photos,
        verified: profile.verified,
        boosted: profile.boosted,
        live: profile.live,
        services: profile.services.slice(0, 3).map((service) => service.name),
      })),
    });
  }
}

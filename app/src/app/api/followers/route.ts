import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { ageFrom } from "@/lib/user";
import { markFollowersSeen } from "@/lib/social";
import { failFrom } from "@/lib/http";

const PROFILE = { select: { displayName: true, avatarUrl: true, city: true, verified: true, birthDate: true, role: true, adminHidden: true } } as const;

/** Your followers (newest first, marking them seen) or the people you follow. */
export async function GET(req: Request) {
  const me = await getSessionUserId();
  if (!me) return NextResponse.json({ error: "Sign in to see your followers" }, { status: 401 });
  if (isMockUserId(me)) return NextResponse.json({ tab: "followers", people: [], counts: { followers: 0, following: 0 } });
  const tab = new URL(req.url).searchParams.get("tab") === "following" ? "following" : "followers";

  try {
    const visible = { bannedAt: null, profile: { adminHidden: false } };
    const [rows, followersCount, followingCount] = await Promise.all([
      tab === "followers"
        ? db.follow
            .findMany({
              where: { followingId: me, follower: visible },
              orderBy: { createdAt: "desc" },
              take: 300,
              include: { follower: { select: { id: true, profile: PROFILE } } },
            })
            .then((list) => list.map((r) => ({ user: r.follower, createdAt: r.createdAt, seenAt: r.seenAt })))
        : db.follow
            .findMany({
              where: { followerId: me, following: visible },
              orderBy: { createdAt: "desc" },
              take: 300,
              include: { following: { select: { id: true, profile: PROFILE } } },
            })
            .then((list) => list.map((r) => ({ user: r.following, createdAt: r.createdAt, seenAt: r.seenAt }))),
      db.follow.count({ where: { followingId: me, follower: { bannedAt: null } } }),
      db.follow.count({ where: { followerId: me, following: { bannedAt: null } } }),
    ]);

    const otherIds = rows.map((r) => r.user.id);
    // For followers: do you follow them back? For following: do they follow you?
    const reverse = otherIds.length
      ? await db.follow.findMany({
          where: tab === "followers" ? { followerId: me, followingId: { in: otherIds } } : { followingId: me, followerId: { in: otherIds } },
          select: { followerId: true, followingId: true },
        })
      : [];
    const reverseSet = new Set(reverse.map((r) => (tab === "followers" ? r.followingId : r.followerId)));

    const people = rows.flatMap((r) => {
      const user = r.user;
      const p = user.profile;
      if (!p) return [];
      return [
        {
          userId: user.id,
          displayName: p.displayName,
          age: ageFrom(p.birthDate),
          avatarUrl: p.avatarUrl,
          city: p.city,
          verified: p.verified,
          escort: p.role === "ESCORT",
          since: r.createdAt,
          isNew: tab === "followers" && !r.seenAt,
          youFollow: tab === "following" ? true : reverseSet.has(user.id),
          followsYou: tab === "followers" ? true : reverseSet.has(user.id),
        },
      ];
    });

    if (tab === "followers") await markFollowersSeen(me);
    return NextResponse.json(
      { tab, people, counts: { followers: followersCount, following: followingCount } },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    return failFrom(err);
  }
}

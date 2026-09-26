import { db } from "./db";
import { emitRealtime } from "./realtime";
import { sendMatchEmail } from "./mailer";

/**
 * Follows and message requests.
 *
 * Following is one way. Two people who follow each other get a conversation
 * straight away (the old mutual like "match"). Messaging someone who does not
 * follow you opens a PENDING conversation: it waits in their Requests tab and
 * only you can write until they accept. They can also decline, which closes it.
 */

export class SocialError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function pair(a: string, b: string) {
  const [userAId, userBId] = [a, b].sort();
  return { userAId, userBId };
}

async function reachable(userId: string) {
  return db.user.findFirst({
    where: { id: userId, bannedAt: null, profile: { isNot: null } },
    select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } },
  });
}

export async function isFollowing(followerId: string, followingId: string) {
  const row = await db.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } }, select: { id: true } });
  return !!row;
}

/** Accept every request `requesterId` sent to `userId`. Used when `userId` follows them. */
async function acceptRequestsFrom(requesterId: string, userId: string) {
  const { userAId, userBId } = pair(requesterId, userId);
  const updated = await db.match.updateMany({
    where: { userAId, userBId, status: "PENDING", requestedById: requesterId },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  if (updated.count) {
    const match = await db.match.findUnique({ where: { userAId_userBId: { userAId, userBId } }, select: { id: true } });
    if (match) await emitRealtime({ userIds: [requesterId, userId] }, "dm:request", { matchId: match.id, status: "ACCEPTED" });
  }
}

export async function follow(followerId: string, followingId: string) {
  if (followerId === followingId) throw new SocialError("You cannot follow yourself", 400);
  const [target, me] = await Promise.all([reachable(followingId), reachable(followerId)]);
  if (!target) throw new SocialError("Profile not available", 404);
  if (!me) throw new SocialError("Finish your profile first", 403);

  const existing = await db.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
  if (!existing) {
    await db.follow
      .create({ data: { followerId, followingId } })
      .catch((err: { code?: string }) => {
        if (err?.code !== "P2002") throw err;
      });
  }
  // Keeps Discover from showing the card again, as a like used to.
  await db.swipe.upsert({
    where: { swiperId_swipedId: { swiperId: followerId, swipedId: followingId } },
    create: { swiperId: followerId, swipedId: followingId, liked: true },
    update: { liked: true },
  });

  await acceptRequestsFrom(followingId, followerId);

  let matchId: string | null = null;
  let newMatch = false;
  if (await isFollowing(followingId, followerId)) {
    const ids = pair(followerId, followingId);
    const current = await db.match.findUnique({ where: { userAId_userBId: ids } });
    if (!current) {
      const created = await db.match
        .create({ data: { ...ids, status: "ACCEPTED" } })
        .catch(async (err: { code?: string }) => {
          if (err?.code !== "P2002") throw err;
          return db.match.findUnique({ where: { userAId_userBId: ids } });
        });
      matchId = created?.id ?? null;
      newMatch = true;
    } else {
      matchId = current.id;
      if (current.status !== "ACCEPTED") {
        await db.match.update({ where: { id: current.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      }
    }
    if (newMatch && me.email && target.email) {
      try {
        await Promise.all([
          sendMatchEmail(me.email, target.profile?.displayName ?? "A member"),
          sendMatchEmail(target.email, me.profile?.displayName ?? "A member"),
        ]);
      } catch (err) {
        console.error("Match email failed:", err);
      }
    }
  }

  if (!existing) {
    await emitRealtime({ userIds: [followingId] }, "follow:new", {
      followerId,
      name: me.profile?.displayName ?? "A member",
      avatarUrl: me.profile?.avatarUrl ?? "",
    });
  }
  return { following: true, mutual: !!matchId, matchId, newMatch };
}

export async function unfollow(followerId: string, followingId: string) {
  await db.follow.deleteMany({ where: { followerId, followingId } });
  await db.swipe.updateMany({ where: { swiperId: followerId, swipedId: followingId }, data: { liked: false } });
  return { following: false };
}

export async function unseenFollowers(userId: string) {
  return db.follow.count({ where: { followingId: userId, seenAt: null, follower: { bannedAt: null } } });
}

export async function markFollowersSeen(userId: string) {
  await db.follow.updateMany({ where: { followingId: userId, seenAt: null }, data: { seenAt: new Date() } });
}

// ---------------------------------------------------------------- messaging

type MatchState = { status: "ACCEPTED" | "PENDING" | "DECLINED"; requestedById: string | null };

/** Whether `userId` may write in a conversation right now. */
export function canWrite(match: MatchState, userId: string) {
  if (match.status === "ACCEPTED") return true;
  if (match.status === "PENDING") return match.requestedById === userId;
  return false;
}

/** How the conversation looks to `userId`: open, a request they sent, one they received, or declined. */
export function viewerState(match: MatchState, userId: string) {
  if (match.status === "ACCEPTED") return "open" as const;
  if (match.status === "DECLINED") return match.requestedById === userId ? ("declined_by_them" as const) : ("declined_by_me" as const);
  return match.requestedById === userId ? ("request_sent" as const) : ("request_received" as const);
}

/**
 * Open (or find) a conversation with `otherId`. It is open at once when they
 * follow you; otherwise it becomes a message request they have to accept.
 */
export async function startConversation(userId: string, otherId: string) {
  if (userId === otherId) throw new SocialError("You cannot message yourself", 400);
  const [other, me] = await Promise.all([reachable(otherId), reachable(userId)]);
  if (!other) throw new SocialError("Profile not available", 404);
  if (!me) throw new SocialError("Finish your profile first", 403);

  const ids = pair(userId, otherId);
  const existing = await db.match.findUnique({ where: { userAId_userBId: ids } });
  if (existing) {
    // Replying to a request they sent, or reaching out after declining theirs, opens it.
    if (existing.status !== "ACCEPTED" && existing.requestedById === otherId) {
      const opened = await db.match.update({ where: { id: existing.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      await emitRealtime({ userIds: [otherId, userId] }, "dm:request", { matchId: opened.id, status: "ACCEPTED" });
      return opened;
    }
    return existing;
  }

  const theyFollowMe = await isFollowing(otherId, userId);
  const created = await db.match
    .create({
      data: theyFollowMe ? { ...ids, status: "ACCEPTED" } : { ...ids, status: "PENDING", requestedById: userId },
    })
    .catch(async (err: { code?: string }) => {
      if (err?.code !== "P2002") throw err;
      return db.match.findUnique({ where: { userAId_userBId: ids } });
    });
  if (!created) throw new SocialError("Could not open the conversation", 500);
  return created;
}

/** The recipient of a request accepts or declines it. */
export async function respondToRequest(matchId: string, userId: string, accept: boolean) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) throw new SocialError("Not found", 404);
  if (match.status === "ACCEPTED") return match;
  if (match.requestedById === userId) throw new SocialError("Only the person you messaged can answer this request", 403);
  if (match.status === "DECLINED" && !accept) return match;
  const updated = await db.match.update({
    where: { id: matchId },
    data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
  });
  const otherId = match.userAId === userId ? match.userBId : match.userAId;
  // The sender is not told about a decline; their composer just closes next time they open the chat.
  await emitRealtime({ userIds: accept ? [otherId, userId] : [userId] }, "dm:request", { matchId, status: updated.status });
  return updated;
}

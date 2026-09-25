import { randomUUID } from "node:crypto";
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from "livekit-server-sdk";
import { db } from "./db";
import { VISIBLE_PROFILE } from "./moderation";
import { ageFrom } from "./user";

export class LiveError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const DEFAULT_GIFTS = [
  { name: "Rose", emoji: "🌹", coins: 1, sortOrder: 1 },
  { name: "Heart", emoji: "💖", coins: 10, sortOrder: 2 },
  { name: "Fire", emoji: "🔥", coins: 50, sortOrder: 3 },
  { name: "Diamond", emoji: "💎", coins: 200, sortOrder: 4 },
  { name: "Crown", emoji: "👑", coins: 1000, sortOrder: 5 },
];

/** How long a host may be disconnected before the live is closed. */
const HOST_GRACE_MS = 90_000;
const TOKEN_TTL = "6h";

function config() {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL || "http://127.0.0.1:7880";
  const publicUrl = process.env.LIVEKIT_PUBLIC_URL;
  if (!key || !secret || !publicUrl) throw new LiveError("Live video is not configured on this server", 503);
  return { key, secret, url, publicUrl };
}

export function liveConfigured() {
  return Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_PUBLIC_URL);
}

let rooms: RoomServiceClient | null = null;
function roomService() {
  if (!rooms) {
    const c = config();
    rooms = new RoomServiceClient(c.url, c.key, c.secret);
  }
  return rooms;
}

export function webhookReceiver() {
  const c = config();
  return new WebhookReceiver(c.key, c.secret);
}

// ---------------------------------------------------------------- gifts

export async function ensureGifts() {
  if ((await db.liveGift.count()) === 0) {
    await db.liveGift.createMany({ data: DEFAULT_GIFTS });
  }
}

export async function activeGifts() {
  await ensureGifts();
  return db.liveGift.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { coins: "asc" }],
    select: { id: true, name: true, emoji: true, coins: true },
  });
}

// ---------------------------------------------------------------- events

export type LiveEvent =
  | { t: "comment"; id: string; userId: string; name: string; avatarUrl: string; body: string; at: string }
  | { t: "gift"; id: string; userId: string; name: string; giftId: string; giftName: string; emoji: string; coins: number; at: string }
  | { t: "ended"; at: string };

export async function broadcast(roomName: string, event: LiveEvent) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(event));
    await roomService().sendData(roomName, bytes, DataPacket_Kind.RELIABLE, { topic: "live" });
  } catch (err) {
    // The room may already be gone; the event is persisted where it matters.
    console.warn("live broadcast failed", (err as Error).message);
  }
}

// ---------------------------------------------------------------- tokens

async function token(identity: string, name: string, roomName: string, host: boolean) {
  const c = config();
  const at = new AccessToken(c.key, c.secret, {
    identity,
    name,
    ttl: TOKEN_TTL,
    metadata: JSON.stringify({ host }),
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublish: host,
    canPublishSources: host ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    // Comments and gifts go through the server so they can be checked and stored.
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return at.toJwt();
}

// ---------------------------------------------------------------- sessions

const hostSelect = {
  userId: true,
  displayName: true,
  avatarUrl: true,
  city: true,
  state: true,
  birthDate: true,
  bio: true,
  interests: true,
  verified: true,
  role: true,
  adminHidden: true,
} as const;

export async function getActiveSessionForHost(hostId: string) {
  return db.liveSession.findFirst({ where: { hostId, status: "LIVE" }, orderBy: { startedAt: "desc" } });
}

export async function startLive(hostId: string, rawTitle: string) {
  const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 80);
  if (title.length < 3) throw new LiveError("Give your live a title (at least 3 characters)");

  const user = await db.user.findUnique({
    where: { id: hostId },
    select: { bannedAt: true, profile: { select: hostSelect } },
  });
  if (!user || user.bannedAt || !user.profile) throw new LiveError("Your account cannot go live right now", 403);
  if (user.profile.role !== "ESCORT") throw new LiveError("Going live is available to escort accounts", 403);
  if (user.profile.adminHidden) throw new LiveError("Your profile is under review, so you cannot go live yet", 403);

  const previous = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`live:${hostId}`}))`;
    const open = await tx.liveSession.findMany({ where: { hostId, status: "LIVE" }, select: { id: true, roomName: true } });
    if (open.length) {
      await tx.liveSession.updateMany({
        where: { id: { in: open.map((s) => s.id) } },
        data: { status: "ENDED", endedAt: new Date(), endReason: "replaced" },
      });
    }
    const session = await tx.liveSession.create({
      data: { hostId, title, roomName: `h247live_${randomUUID().replace(/-/g, "")}` },
    });
    await tx.profile.update({ where: { userId: hostId }, data: { isLive: true, lastActive: new Date() } });
    return { open, session };
  });

  for (const old of previous.open) {
    await broadcast(old.roomName, { t: "ended", at: new Date().toISOString() });
    await roomService().deleteRoom(old.roomName).catch(() => undefined);
  }

  const session = previous.session;
  await roomService().createRoom({
    name: session.roomName,
    emptyTimeout: 120,
    departureTimeout: 30,
    maxParticipants: 1000,
    metadata: JSON.stringify({ sessionId: session.id, hostId }),
  });

  return {
    session,
    url: config().publicUrl,
    token: await token(hostId, user.profile.displayName, session.roomName, true),
  };
}

/** Token for joining an active live. The host gets publish rights back when reconnecting. */
export async function joinToken(sessionId: string, userId: string) {
  const [session, viewer] = await Promise.all([
    db.liveSession.findUnique({ where: { id: sessionId } }),
    db.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true, profile: { select: { displayName: true } } },
    }),
  ]);
  if (!session || session.status !== "LIVE") throw new LiveError("This live has ended", 410);
  const isHost = session.hostId === userId;
  if (!viewer || viewer.bannedAt) throw new LiveError("Your account cannot join lives right now", 403);
  if (!isHost) {
    const host = await db.profile.findFirst({ where: { AND: [VISIBLE_PROFILE, { userId: session.hostId }] }, select: { userId: true } });
    if (!host) throw new LiveError("This live is not available", 404);
  }
  const name = viewer.profile?.displayName || "Member";
  return {
    isHost,
    url: config().publicUrl,
    token: await token(userId, name, session.roomName, isHost),
  };
}

export async function liveSummary(sessionId: string) {
  const session = await db.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new LiveError("Live not found", 404);
  const [earned, supporters, comments] = await Promise.all([
    db.coinTransaction.aggregate({
      where: { liveSessionId: sessionId, userId: session.hostId, type: "TIP_RECEIVED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.coinTransaction.groupBy({
      by: ["counterpartyId"],
      where: { liveSessionId: sessionId, userId: session.hostId, type: "TIP_RECEIVED" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    db.liveComment.count({ where: { sessionId } }),
  ]);
  const ids = supporters.map((s) => s.counterpartyId).filter((id): id is string => !!id);
  const profiles = ids.length
    ? await db.profile.findMany({ where: { userId: { in: ids } }, select: { userId: true, displayName: true, avatarUrl: true } })
    : [];
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  const end = session.endedAt ?? new Date();
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationSeconds: Math.max(0, Math.round((end.getTime() - session.startedAt.getTime()) / 1000)),
    peakViewers: session.peakViewers,
    coinsEarned: earned._sum.amount ?? 0,
    gifts: earned._count,
    comments,
    topSupporters: supporters.map((s) => ({
      userId: s.counterpartyId ?? "",
      displayName: byId.get(s.counterpartyId ?? "")?.displayName ?? "Member",
      avatarUrl: byId.get(s.counterpartyId ?? "")?.avatarUrl ?? "",
      coins: s._sum.amount ?? 0,
    })),
  };
}

export async function endLive(sessionId: string, reason: string) {
  const session = await db.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new LiveError("Live not found", 404);
  if (session.status === "LIVE") {
    const changed = await db.liveSession.updateMany({
      where: { id: sessionId, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date(), endReason: reason.slice(0, 40) },
    });
    if (changed.count) {
      const stillLive = await db.liveSession.count({ where: { hostId: session.hostId, status: "LIVE" } });
      if (!stillLive) await db.profile.updateMany({ where: { userId: session.hostId }, data: { isLive: false } });
      await broadcast(session.roomName, { t: "ended", at: new Date().toISOString() });
      await roomService().deleteRoom(session.roomName).catch(() => undefined);
    }
  }
  return liveSummary(sessionId);
}

// ---------------------------------------------------------------- presence

type RoomCounts = Map<string, { viewers: number; hostPresent: boolean }>;

async function roomCounts(sessions: { roomName: string; hostId: string }[]): Promise<RoomCounts> {
  const counts: RoomCounts = new Map();
  if (!sessions.length) return counts;
  const svc = roomService();
  const list = await svc.listRooms(sessions.map((s) => s.roomName));
  const live = new Set(list.map((r) => r.name));
  await Promise.all(
    sessions.map(async (s) => {
      if (!live.has(s.roomName)) return;
      const participants = await svc.listParticipants(s.roomName).catch(() => []);
      const hostPresent = participants.some((p) => p.identity === s.hostId);
      counts.set(s.roomName, {
        hostPresent,
        viewers: participants.filter((p) => p.identity !== s.hostId).length,
      });
    })
  );
  return counts;
}

let lastReconcile = 0;

/**
 * Keep the database in step with the media server: close lives whose host has
 * been gone for longer than the grace period and clear stale "live" flags.
 */
export async function reconcileLives(force = false) {
  if (!liveConfigured()) return { ended: 0 };
  if (!force && Date.now() - lastReconcile < 10_000) return { ended: 0 };
  lastReconcile = Date.now();

  const open = await db.liveSession.findMany({ where: { status: "LIVE" } });
  let ended = 0;
  let counts: RoomCounts;
  try {
    counts = await roomCounts(open);
  } catch (err) {
    console.warn("live reconcile skipped", (err as Error).message);
    return { ended: 0 };
  }
  const now = Date.now();
  for (const s of open) {
    const c = counts.get(s.roomName);
    if (c?.hostPresent) {
      await db.liveSession.update({
        where: { id: s.id },
        data: { hostSeenAt: new Date(), peakViewers: Math.max(s.peakViewers, c.viewers) },
      });
    } else if (now - s.hostSeenAt.getTime() > HOST_GRACE_MS) {
      await endLive(s.id, c ? "host_left" : "room_closed");
      ended += 1;
    }
  }
  await db.profile.updateMany({
    where: { isLive: true, user: { liveSessions: { none: { status: "LIVE" } } } },
    data: { isLive: false },
  });
  return { ended };
}

export type LiveListing = {
  sessionId: string;
  title: string;
  startedAt: string;
  viewers: number;
  host: {
    userId: string;
    displayName: string;
    age: number;
    city: string;
    state: string;
    avatarUrl: string;
    verified: boolean;
    interests: string[];
  };
};

export async function listLives(): Promise<LiveListing[]> {
  await reconcileLives().catch((err) => console.warn("live reconcile failed", err));
  const sessions = await db.liveSession.findMany({
    where: { status: "LIVE", host: { bannedAt: null, profile: { adminHidden: false } } },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { host: { select: { profile: { select: hostSelect } } } },
  });
  let counts: RoomCounts = new Map();
  try {
    counts = await roomCounts(sessions);
  } catch {
    counts = new Map();
  }
  return sessions
    .filter((s) => s.host.profile)
    .map((s) => {
      const p = s.host.profile!;
      return {
        sessionId: s.id,
        title: s.title,
        startedAt: s.startedAt.toISOString(),
        viewers: counts.get(s.roomName)?.viewers ?? 0,
        host: {
          userId: p.userId,
          displayName: p.displayName,
          age: ageFrom(p.birthDate),
          city: p.city,
          state: p.state,
          avatarUrl: p.avatarUrl,
          verified: p.verified,
          interests: p.interests,
        },
      };
    })
    .sort((a, b) => b.viewers - a.viewers);
}

/** The live a host is running right now, if their profile is publicly visible. */
export async function liveForHost(hostId: string, viewerId: string | null) {
  const session = await getActiveSessionForHost(hostId);
  if (!session) return null;
  const profile = await db.profile.findFirst({
    where: viewerId === hostId ? { userId: hostId } : { AND: [VISIBLE_PROFILE, { userId: hostId }] },
    select: { ...hostSelect, services: { where: { enabled: true }, take: 3, select: { name: true } } },
  });
  if (!profile) return null;
  return {
    session: { id: session.id, title: session.title, startedAt: session.startedAt.toISOString() },
    host: {
      userId: profile.userId,
      displayName: profile.displayName,
      age: ageFrom(profile.birthDate),
      city: profile.city,
      state: profile.state,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      interests: profile.interests,
      services: profile.services.map((s) => s.name),
      verified: profile.verified,
    },
  };
}

export async function recentComments(sessionId: string) {
  const rows = await db.liveComment.findMany({
    where: { sessionId, user: { bannedAt: null } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } } },
  });
  return rows.reverse().map((c) => ({
    t: "comment" as const,
    id: c.id,
    userId: c.userId,
    name: c.user.profile?.displayName ?? "Member",
    avatarUrl: c.user.profile?.avatarUrl ?? "",
    body: c.body,
    at: c.createdAt.toISOString(),
  }));
}

export async function markHostSeen(roomName: string, viewers?: number) {
  const session = await db.liveSession.findUnique({ where: { roomName } });
  if (!session || session.status !== "LIVE") return;
  await db.liveSession.update({
    where: { id: session.id },
    data: {
      hostSeenAt: new Date(),
      ...(viewers !== undefined ? { peakViewers: Math.max(session.peakViewers, viewers) } : {}),
    },
  });
}

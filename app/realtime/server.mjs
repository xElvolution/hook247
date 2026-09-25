// Realtime delivery for Hooks247: DMs (new message, typing, read receipts,
// presence) and the public lounge. Messages are written by the Next.js app;
// this process only fans events out to connected browsers.
//
// Run: node --env-file=.env realtime/server.mjs   (pm2: hook247-realtime)

import http from "node:http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { PrismaClient } from "@prisma/client";

const PORT = Number(process.env.REALTIME_PORT || 3110);
const HOST = process.env.REALTIME_HOST || "127.0.0.1";
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error("AUTH_SECRET is required");
  process.exit(1);
}

const tokenKey = new TextEncoder().encode(`${AUTH_SECRET}::realtime`);
const internalSecret = crypto.createHash("sha256").update(`${AUTH_SECRET}::realtime-internal`).digest("hex");
const origins = [
  "https://hooks247.com",
  "https://app.hooks247.com",
  "https://www.hooks247.com",
  ...(process.env.REALTIME_EXTRA_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
];

function neonUrl(raw) {
  let url = raw || "";
  const add = (key, value) => {
    if (!url || url.includes(`${key}=`)) return;
    url += (url.includes("?") ? "&" : "?") + `${key}=${value}`;
  };
  add("pgbouncer", "true");
  add("connect_timeout", "15");
  add("pool_timeout", "20");
  add("connection_limit", "3");
  return url;
}

const db = new PrismaClient({ datasourceUrl: neonUrl(process.env.DATABASE_URL), log: ["error"] });
const LOUNGE = "lounge";

// ------------------------------------------------------------ membership cache

const matchCache = new Map(); // matchId -> { a, b, banned, at }

async function loadMatch(matchId) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { userAId: true, userBId: true, userA: { select: { bannedAt: true } }, userB: { select: { bannedAt: true } } },
  });
  if (!match) {
    matchCache.delete(matchId);
    return null;
  }
  const entry = {
    a: match.userAId,
    b: match.userBId,
    banned: new Set([match.userA.bannedAt ? match.userAId : null, match.userB.bannedAt ? match.userBId : null].filter(Boolean)),
    at: Date.now(),
  };
  matchCache.set(matchId, entry);
  if (matchCache.size > 20_000) matchCache.delete(matchCache.keys().next().value);
  return entry;
}

// Serve from cache and refresh in the background once an entry is a minute old,
// so a send never waits on the database for membership.
async function matchMembers(matchId) {
  if (typeof matchId !== "string" || matchId.length > 64) return null;
  const hit = matchCache.get(matchId);
  if (hit) {
    if (Date.now() - hit.at > 60_000 && !hit.refreshing) {
      hit.refreshing = true;
      loadMatch(matchId).catch(() => (hit.refreshing = false));
    }
    return hit;
  }
  return loadMatch(matchId);
}

function otherMember(members, userId) {
  if (!members) return null;
  if (members.a === userId) return members.b;
  if (members.b === userId) return members.a;
  return null;
}

// Bans and suspensions must bite on open sockets too, not only at connect.
const standingCache = new Map(); // userId -> { ok, at }
async function loadStanding(userId) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { bannedAt: true, suspendedUntil: true } }).catch(() => null);
  const ok = Boolean(user && !user.bannedAt && !(user.suspendedUntil && user.suspendedUntil > new Date()));
  standingCache.set(userId, { ok, at: Date.now() });
  return ok;
}
async function inGoodStanding(userId) {
  const hit = standingCache.get(userId);
  if (hit) {
    if (Date.now() - hit.at > 60_000 && !hit.refreshing) {
      hit.refreshing = true;
      loadStanding(userId).catch(() => (hit.refreshing = false));
    }
    return hit.ok;
  }
  return loadStanding(userId);
}

// ------------------------------------------------------------ presence

const online = new Map(); // userId -> socket count
const lastSeen = new Map(); // userId -> ms

function presenceOf(userId) {
  return { userId, online: (online.get(userId) || 0) > 0, lastSeen: lastSeen.get(userId) || null };
}

// ------------------------------------------------------------ server

const httpServer = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, sockets: io.engine.clientsCount }));
    return;
  }
  if (req.method === "POST" && req.url === "/internal/emit") {
    if (req.headers["x-internal-secret"] !== internalSecret) {
      res.writeHead(401).end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 256_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const msg = JSON.parse(body);
        const event = String(msg.event || "");
        if (!/^[a-z:]{3,40}$/.test(event)) throw new Error("bad event");
        if (Array.isArray(msg.userIds)) {
          for (const id of msg.userIds.slice(0, 50)) io.to(`user:${id}`).emit(event, msg.payload);
        }
        if (msg.room === LOUNGE) io.to(LOUNGE).emit(event, msg.payload);
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: origins, credentials: false },
  pingInterval: 20_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 16_000,
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") throw new Error("missing token");
    const { payload } = await jwtVerify(token, tokenKey, { algorithms: ["HS256"] });
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) throw new Error("bad token");
    const user = await db.user.findUnique({ where: { id: userId }, select: { bannedAt: true, suspendedUntil: true } }).catch(() => null);
    if (!user || user.bannedAt || (user.suspendedUntil && user.suspendedUntil > new Date())) throw new Error("not allowed");
    socket.data.userId = userId;
    standingCache.set(userId, { ok: true, at: Date.now() });
    const profile = await db.profile
      .findUnique({ where: { userId }, select: { displayName: true, avatarUrl: true, verified: true, role: true } })
      .catch(() => null);
    socket.data.profile = profile;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

function limiter(max, perMs) {
  const hits = [];
  return () => {
    const now = Date.now();
    while (hits.length && now - hits[0] > perMs) hits.shift();
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);
  const count = (online.get(userId) || 0) + 1;
  online.set(userId, count);
  if (count === 1) io.to(`presence:${userId}`).emit("presence", presenceOf(userId));

  const allowTyping = limiter(20, 10_000);
  const allowSend = limiter(12, 10_000);
  const allowLounge = limiter(1, 1_500);

  // Direct message sent over the socket: delivered at once, stored in parallel.
  socket.on("dm:send", async (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => undefined;
    try {
      if (!allowSend()) return reply({ ok: false, error: "You are sending messages too fast" });
      if (!(await inGoodStanding(userId))) {
        reply({ ok: false, error: "Your account cannot send messages right now" });
        return socket.disconnect(true);
      }
      const body = typeof data?.body === "string" ? data.body.trim().slice(0, 2000) : "";
      const clientId = typeof data?.clientId === "string" ? data.clientId.slice(0, 64) : undefined;
      if (!body) return reply({ ok: false, error: "Write a message first" });
      const members = await matchMembers(data?.matchId);
      const other = otherMember(members, userId);
      if (!other) return reply({ ok: false, error: "Conversation not found" });
      if (members.banned.has(other)) return reply({ ok: false, error: "This conversation is no longer available." });

      const message = { id: crypto.randomUUID(), body, senderId: userId, at: new Date().toISOString(), readAt: null };
      const payload = { matchId: data.matchId, clientId, message };
      io.to(`user:${other}`).to(`user:${userId}`).emit("dm:message", payload);
      try {
        await db.message.create({ data: { id: message.id, matchId: data.matchId, senderId: userId, body, createdAt: new Date(message.at) } });
      } catch (err) {
        io.to(`user:${other}`).to(`user:${userId}`).emit("dm:retract", { matchId: data.matchId, id: message.id });
        throw err;
      }
      reply({ ok: true, message });
    } catch (err) {
      console.error("dm:send failed", err?.message);
      reply({ ok: false, error: "Message not sent" });
    }
  });

  socket.on("lounge:send", async (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => undefined;
    try {
      const profile = socket.data.profile;
      if (!profile) return reply({ ok: false, error: "Finish your profile to chat" });
      if (!allowLounge()) return reply({ ok: false, error: "You are sending messages too fast" });
      if (!(await inGoodStanding(userId))) {
        reply({ ok: false, error: "Your account cannot send messages right now" });
        return socket.disconnect(true);
      }
      const body = typeof data?.body === "string" ? data.body.replace(/[ \t]+/g, " ").trim().slice(0, 500) : "";
      const clientId = typeof data?.clientId === "string" ? data.clientId.slice(0, 64) : undefined;
      if (!body) return reply({ ok: false, error: "Write a message first" });
      const at = new Date();
      const message = {
        id: crypto.randomUUID(),
        userId,
        body,
        at: at.toISOString(),
        name: profile.displayName,
        avatarUrl: profile.avatarUrl,
        verified: profile.verified,
        escort: profile.role === "ESCORT",
        clientId,
      };
      io.to(LOUNGE).emit("lounge:message", message);
      try {
        await db.loungeMessage.create({ data: { id: message.id, userId, body, createdAt: at } });
      } catch (err) {
        io.to(LOUNGE).emit("lounge:retract", { id: message.id });
        throw err;
      }
      reply({ ok: true, message });
    } catch (err) {
      console.error("lounge:send failed", err?.message);
      reply({ ok: false, error: "Message not sent" });
    }
  });
  const allowRead = limiter(30, 10_000);

  socket.on("dm:typing", async (data) => {
    if (!allowTyping()) return;
    const members = await matchMembers(data?.matchId).catch(() => null);
    const other = otherMember(members, userId);
    if (!other) return;
    io.to(`user:${other}`).emit("dm:typing", { matchId: data.matchId, userId, typing: Boolean(data.typing) });
  });

  socket.on("dm:read", async (data, ack) => {
    if (!allowRead()) return;
    const members = await matchMembers(data?.matchId).catch(() => null);
    const other = otherMember(members, userId);
    if (!other) return;
    const readAt = new Date();
    const result = await db.message
      .updateMany({ where: { matchId: data.matchId, senderId: other, readAt: null }, data: { readAt } })
      .catch(() => ({ count: 0 }));
    if (result.count > 0) {
      io.to(`user:${other}`).emit("dm:read", { matchId: data.matchId, readerId: userId, readAt: readAt.toISOString() });
    }
    // Let this user's other tabs clear their unread badge too.
    io.to(`user:${userId}`).emit("dm:seen", { matchId: data.matchId });
    if (typeof ack === "function") ack({ ok: true, count: result.count });
  });

  socket.on("presence:watch", async (data, ack) => {
    const members = await matchMembers(data?.matchId).catch(() => null);
    const other = otherMember(members, userId);
    if (!other) return typeof ack === "function" && ack(null);
    socket.join(`presence:${other}`);
    if (typeof ack === "function") ack(presenceOf(other));
  });

  socket.on("presence:unwatch", async (data) => {
    const members = await matchMembers(data?.matchId).catch(() => null);
    const other = otherMember(members, userId);
    if (other) socket.leave(`presence:${other}`);
  });

  socket.on("lounge:join", (_data, ack) => {
    socket.join(LOUNGE);
    const size = io.sockets.adapter.rooms.get(LOUNGE)?.size || 0;
    io.to(LOUNGE).emit("lounge:count", { online: size });
    if (typeof ack === "function") ack({ online: size });
  });

  socket.on("lounge:leave", () => {
    socket.leave(LOUNGE);
    io.to(LOUNGE).emit("lounge:count", { online: io.sockets.adapter.rooms.get(LOUNGE)?.size || 0 });
  });

  socket.on("disconnecting", () => {
    if (socket.rooms.has(LOUNGE)) {
      setTimeout(() => io.to(LOUNGE).emit("lounge:count", { online: io.sockets.adapter.rooms.get(LOUNGE)?.size || 0 }), 50);
    }
  });

  socket.on("disconnect", () => {
    const left = (online.get(userId) || 1) - 1;
    if (left <= 0) {
      online.delete(userId);
      lastSeen.set(userId, Date.now());
      io.to(`presence:${userId}`).emit("presence", presenceOf(userId));
    } else {
      online.set(userId, left);
    }
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`realtime listening on ${HOST}:${PORT}`);
});

async function shutdown() {
  io.close();
  await db.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

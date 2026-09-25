import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { emitRealtime } from "@/lib/realtime";
import { failFrom } from "@/lib/http";

const MIN_GAP_MS = 1500;

const author = { select: { profile: { select: { displayName: true, avatarUrl: true, verified: true, role: true } } } } as const;

type Row = {
  id: string;
  userId: string;
  body: string;
  createdAt: Date;
  user: { profile: { displayName: string; avatarUrl: string; verified: boolean; role: string } | null };
};

function loungeView(m: Row) {
  return {
    id: m.id,
    userId: m.userId,
    body: m.body,
    at: m.createdAt.toISOString(),
    name: m.user.profile?.displayName ?? "Member",
    avatarUrl: m.user.profile?.avatarUrl ?? "",
    verified: m.user.profile?.verified ?? false,
    escort: m.user.profile?.role === "ESCORT",
  };
}

export async function GET(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to join the lounge" }, { status: 401 });
  const before = new URL(req.url).searchParams.get("before");
  try {
    const rows = await db.loungeMessage.findMany({
      where: {
        hiddenAt: null,
        user: { bannedAt: null },
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: author },
    });
    return NextResponse.json({ me: userId, messages: rows.reverse().map(loungeView), more: rows.length === 60 });
  } catch (err) {
    return failFrom(err);
  }
}

const schema = z.object({ body: z.string().min(1).max(1000), clientId: z.string().max(64).optional() });

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to chat" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Create an account to chat in the lounge" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const body = parsed.success ? parsed.data.body.replace(/[ \t]+/g, " ").trim().slice(0, 500) : "";
  if (!body) return NextResponse.json({ error: "Write a message first" }, { status: 400 });

  try {
    const [profile, last] = await Promise.all([
      db.profile.findUnique({ where: { userId }, select: { displayName: true, avatarUrl: true, verified: true, role: true } }),
      db.loungeMessage.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    if (!profile) return NextResponse.json({ error: "Finish your profile to chat" }, { status: 403 });
    if (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MS) {
      return NextResponse.json({ error: "You are sending messages too fast" }, { status: 429 });
    }
    const row = { id: randomUUID(), userId, body, createdAt: new Date(), user: { profile } };
    await db.loungeMessage.create({ data: { id: row.id, userId, body, createdAt: row.createdAt } });
    const message = { ...loungeView(row), clientId: parsed.success ? parsed.data.clientId : undefined };
    await emitRealtime({ room: "lounge" }, "lounge:message", message);
    return NextResponse.json({ message });
  } catch (err) {
    return failFrom(err);
  }
}

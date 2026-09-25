import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId, mockSend, mockThread } from "@/lib/mock";
import { emitRealtime } from "@/lib/realtime";
import { failFrom } from "@/lib/http";

async function assertMember(matchId: string, userId: string) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) return null;
  return match;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { matchId } = await params;
  if (isMockUserId(userId)) {
    const thread = mockThread(matchId);
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(thread);
  }
  try {
    const match = await assertMember(matchId, userId);
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const otherId = match.userAId === userId ? match.userBId : match.userAId;
    // Opening the thread marks everything the other person sent as read.
    const readAt = new Date();
    const [read, latest, other] = await Promise.all([
      db.message.updateMany({ where: { matchId, senderId: otherId, readAt: null }, data: { readAt } }),
      db.message.findMany({ where: { matchId }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.profile.findUnique({ where: { userId: otherId } }),
    ]);
    if (read.count > 0) {
      await emitRealtime({ userIds: [otherId] }, "dm:read", { matchId, readerId: userId, readAt: readAt.toISOString() });
      await emitRealtime({ userIds: [userId] }, "dm:seen", { matchId });
    }

    return NextResponse.json({
      me: userId,
      other: {
        userId: otherId,
        displayName: other?.displayName ?? "Member",
        avatarUrl: other?.avatarUrl ?? "",
        verified: other?.verified ?? false,
      },
      messages: latest.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderId === userId,
        at: m.createdAt,
        readAt: m.senderId === otherId ? (m.readAt ?? readAt) : m.readAt,
      })),
    });
  } catch (err) {
    return failFrom(err);
  }
}

const postSchema = z.object({ body: z.string().min(1).max(2000), clientId: z.string().max(64).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { matchId } = await params;
  if (isMockUserId(userId)) {
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const thread = mockThread(matchId);
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(mockSend(matchId, parsed.data.body));
  }
  try {
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    const body = parsed.success ? parsed.data.body.trim() : "";
    if (!body) return NextResponse.json({ error: "Write a message first" }, { status: 400 });

    const match = await assertMember(matchId, userId);
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Reading an existing thread stays open, but a banned counterpart cannot be
    // written to — the conversation is effectively closed from both ends.
    const otherId = match.userAId === userId ? match.userBId : match.userAId;
    const other = await db.user.findFirst({
      where: { id: otherId, bannedAt: null },
      select: { id: true },
    });
    if (!other) {
      return NextResponse.json(
        { error: "This conversation is no longer available." },
        { status: 403 }
      );
    }

    const message = await db.message.create({
      data: { matchId, senderId: userId, body },
    });
    const clientId = parsed.success ? parsed.data.clientId : undefined;

    await emitRealtime({ userIds: [otherId, userId] }, "dm:message", {
      matchId,
      clientId,
      message: { id: message.id, body: message.body, senderId: userId, at: message.createdAt.toISOString(), readAt: null },
    });

    return NextResponse.json({
      message: { id: message.id, body: message.body, mine: true, at: message.createdAt, readAt: null, clientId },
    });
  } catch (err) {
    return failFrom(err);
  }
}

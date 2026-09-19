import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId, mockSend, mockThread } from "@/lib/mock";

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
  const match = await assertMember(matchId, userId);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const otherId = match.userAId === userId ? match.userBId : match.userAId;
  const [messages, other] = await Promise.all([
    db.message.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.profile.findUnique({ where: { userId: otherId } }),
  ]);

  return NextResponse.json({
    other: {
      userId: otherId,
      displayName: other?.displayName ?? "Member",
      avatarUrl: other?.avatarUrl ?? "",
      verified: other?.verified ?? false,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === userId,
      at: m.createdAt,
    })),
  });
}

const postSchema = z.object({ body: z.string().min(1).max(2000) });

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
  const match = await assertMember(matchId, userId);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

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
    data: { matchId, senderId: userId, body: parsed.data.body },
  });

  return NextResponse.json({
    message: { id: message.id, body: message.body, mine: true, at: message.createdAt },
  });
}

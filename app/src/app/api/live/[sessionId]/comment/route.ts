import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { broadcast } from "@/lib/live";
import { failFrom } from "@/lib/http";

const schema = z.object({ body: z.string().min(1).max(500) });
const MIN_GAP_MS = 1200;

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Create an account to comment" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const body = parsed.success ? parsed.data.body.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!body) return NextResponse.json({ error: "Write a comment first" }, { status: 400 });

  try {
    const [session, last, profile] = await Promise.all([
      db.liveSession.findUnique({ where: { id: sessionId }, select: { status: true, roomName: true } }),
      db.liveComment.findFirst({ where: { sessionId, userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.profile.findUnique({ where: { userId }, select: { displayName: true, avatarUrl: true } }),
    ]);
    if (!session || session.status !== "LIVE") return NextResponse.json({ error: "This live has ended" }, { status: 410 });
    if (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MS) {
      return NextResponse.json({ error: "Slow down a little" }, { status: 429 });
    }

    const id = randomUUID();
    const createdAt = new Date();
    const event = {
      t: "comment" as const,
      id,
      userId,
      name: profile?.displayName ?? "Member",
      avatarUrl: profile?.avatarUrl ?? "",
      body,
      at: createdAt.toISOString(),
    };
    // Store and fan out together so the room sees the comment without waiting on the write.
    await Promise.all([
      db.liveComment.create({ data: { id, sessionId, userId, body, createdAt } }),
      broadcast(session.roomName, event),
    ]);
    return NextResponse.json({ ok: true, comment: event });
  } catch (err) {
    return failFrom(err);
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { activeGifts, recentComments, reconcileLives } from "@/lib/live";
import { getWallet } from "@/lib/coins";
import { failFrom } from "@/lib/http";

/** Current state of a live: status, recent comments, gift catalogue and the caller's balance. */
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to watch lives" }, { status: 401 });
  try {
    void reconcileLives().catch(() => undefined);
    const session = await db.liveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, hostId: true, title: true, startedAt: true },
    });
    if (!session) return NextResponse.json({ error: "Live not found" }, { status: 404 });
    const [comments, gifts, wallet] = await Promise.all([
      recentComments(sessionId),
      activeGifts(),
      userId.startsWith("mock") ? Promise.resolve({ balance: 0 }) : getWallet(userId),
    ]);
    return NextResponse.json({
      id: session.id,
      status: session.status,
      title: session.title,
      startedAt: session.startedAt,
      isHost: session.hostId === userId,
      comments,
      gifts,
      balance: wallet.balance,
    });
  } catch (err) {
    return failFrom(err);
  }
}

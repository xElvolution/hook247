import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { broadcast } from "@/lib/live";
import { CoinError, sendTip } from "@/lib/coins";
import { failFrom } from "@/lib/http";

const schema = z.object({ giftId: z.string().min(1), nonce: z.string().min(8).max(64) });

/** Send a gift during a live: moves coins from the viewer to the host and shows it to the room. */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send gifts" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Coins are not available on the demo account" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a gift" }, { status: 400 });

  try {
    const [session, gift, sender] = await Promise.all([
      db.liveSession.findUnique({ where: { id: sessionId }, select: { status: true, hostId: true, roomName: true } }),
      db.liveGift.findFirst({ where: { id: parsed.data.giftId, active: true } }),
      db.profile.findUnique({ where: { userId }, select: { displayName: true } }),
    ]);
    if (!session || session.status !== "LIVE") return NextResponse.json({ error: "This live has ended" }, { status: 410 });
    if (!gift) return NextResponse.json({ error: "That gift is no longer available" }, { status: 404 });
    if (session.hostId === userId) return NextResponse.json({ error: "You cannot send gifts to yourself" }, { status: 400 });

    const result = await sendTip({
      fromId: userId,
      toId: session.hostId,
      coins: gift.coins,
      nonce: `live:${parsed.data.nonce}`,
      source: "live",
      liveSessionId: sessionId,
      giftId: gift.id,
      note: `${gift.emoji} ${gift.name}`,
    });

    if (!result.duplicate) {
      await broadcast(session.roomName, {
        t: "gift",
        id: parsed.data.nonce,
        userId,
        name: sender?.displayName ?? "Member",
        giftId: gift.id,
        giftName: gift.name,
        emoji: gift.emoji,
        coins: gift.coins,
        at: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ok: true, balance: result.balance, duplicate: result.duplicate });
  } catch (err) {
    if (err instanceof CoinError) {
      const status = err.code === "INSUFFICIENT" ? 402 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return failFrom(err);
  }
}

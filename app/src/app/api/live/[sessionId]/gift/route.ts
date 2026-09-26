import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { broadcast } from "@/lib/live";
import { CoinError } from "@/lib/coins";
import { sendGift } from "@/lib/earnings";
import { emitRealtime } from "@/lib/realtime";
import { failFrom } from "@/lib/http";
import { coinErrorResponse } from "@/lib/coinHttp";

const schema = z.object({ giftId: z.string().min(1), nonce: z.string().min(8).max(64) });

/**
 * Send a gift during a live: coins leave the viewer at once, the host's share
 * lands in their Earnings Wallet, the room sees the gift and the host's live
 * earnings counter moves.
 */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send gifts" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Coins are not available on the demo account" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a gift" }, { status: 400 });

  try {
    const [session, sender] = await Promise.all([
      db.liveSession.findUnique({ where: { id: sessionId }, select: { status: true, hostId: true, roomName: true } }),
      db.profile.findUnique({ where: { userId }, select: { displayName: true } }),
    ]);
    if (!session || session.status !== "LIVE") return NextResponse.json({ error: "This live has ended" }, { status: 410 });
    if (session.hostId === userId) return NextResponse.json({ error: "You cannot send gifts to yourself" }, { status: 400 });

    const result = await sendGift({
      fromId: userId,
      toId: session.hostId,
      giftId: parsed.data.giftId,
      nonce: `live:${parsed.data.nonce}`,
      source: "live",
      liveSessionId: sessionId,
    });

    if (!result.duplicate) {
      const at = new Date().toISOString();
      await Promise.all([
        broadcast(session.roomName, {
          t: "gift",
          id: parsed.data.nonce,
          userId,
          name: sender?.displayName ?? "Member",
          giftId: parsed.data.giftId,
          giftName: result.giftName,
          emoji: result.emoji,
          coins: result.coins,
          animation: result.animation,
          at,
        }),
        // Only the host hears what they earned; viewers never see naira.
        emitRealtime({ userIds: [session.hostId] }, "live:earning", {
          sessionId,
          id: parsed.data.nonce,
          shareKobo: result.escortShareKobo,
          coins: result.coins,
          giftName: result.giftName,
          emoji: result.emoji,
          from: sender?.displayName ?? "Member",
          at,
        }),
      ]);
    }
    return NextResponse.json({ ok: true, balance: result.balance, duplicate: result.duplicate });
  } catch (err) {
    if (err instanceof CoinError) return coinErrorResponse(err);
    return failFrom(err);
  }
}

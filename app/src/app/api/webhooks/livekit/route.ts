import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endLive, liveConfigured, markHostSeen, webhookReceiver } from "@/lib/live";

/** Room and participant events from the LiveKit server (signed with the API secret). */
export async function POST(req: Request) {
  if (!liveConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const body = await req.text();
  let event;
  try {
    event = await webhookReceiver().receive(body, req.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const roomName = event.room?.name;
  if (!roomName) return NextResponse.json({ ok: true });

  try {
    const session = await db.liveSession.findUnique({ where: { roomName }, select: { id: true, hostId: true, status: true } });
    if (!session) return NextResponse.json({ ok: true });

    if (event.event === "room_finished" && session.status === "LIVE") {
      await endLive(session.id, "room_closed");
    } else if (event.event === "participant_joined" || event.event === "participant_left") {
      const viewers = Math.max(0, (event.room?.numParticipants ?? 0) - 1);
      if (event.participant?.identity === session.hostId && event.event === "participant_joined") {
        await markHostSeen(roomName, viewers);
      } else if (event.participant?.identity === session.hostId) {
        // Host dropped: start the grace period from now; reconcile closes it if they do not return.
        await markHostSeen(roomName);
      } else {
        await db.liveSession.updateMany({
          where: { id: session.id, peakViewers: { lt: viewers } },
          data: { peakViewers: viewers },
        });
      }
    }
  } catch (err) {
    console.error("livekit webhook", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

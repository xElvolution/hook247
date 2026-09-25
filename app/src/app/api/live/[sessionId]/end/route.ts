import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { endLive, LiveError, liveSummary } from "@/lib/live";
import { failFrom } from "@/lib/http";

/** Host ends their live and gets the summary back. GET returns the summary of an ended live. */
export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(params, true);
}

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(params, false);
}

async function handle(params: Promise<{ sessionId: string }>, end: boolean) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const session = await db.liveSession.findUnique({ where: { id: sessionId }, select: { hostId: true } });
    if (!session || session.hostId !== userId) return NextResponse.json({ error: "Live not found" }, { status: 404 });
    return NextResponse.json(end ? await endLive(sessionId, "host_ended") : await liveSummary(sessionId));
  } catch (err) {
    if (err instanceof LiveError) return NextResponse.json({ error: err.message }, { status: err.status });
    return failFrom(err);
  }
}

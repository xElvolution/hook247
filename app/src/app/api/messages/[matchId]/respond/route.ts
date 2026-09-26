import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { respondToRequest, SocialError, viewerState } from "@/lib/social";
import { failFrom } from "@/lib/http";

const schema = z.object({ action: z.enum(["accept", "decline"]) });

/** Accept or decline a message request. */
export async function POST(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const me = await getActiveSessionUserId();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(me)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });
  const { matchId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const match = await respondToRequest(matchId, me, parsed.data.action === "accept");
    return NextResponse.json({ ok: true, status: match.status, state: viewerState(match, me) });
  } catch (err) {
    if (err instanceof SocialError) return NextResponse.json({ error: err.message }, { status: err.status });
    return failFrom(err);
  }
}

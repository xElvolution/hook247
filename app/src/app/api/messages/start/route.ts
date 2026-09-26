import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { SocialError, startConversation, viewerState } from "@/lib/social";
import { failFrom } from "@/lib/http";

const schema = z.object({ userId: z.string().min(1).max(64) });

/** Message someone from their profile: opens the chat, or sends a request if they do not follow you. */
export async function POST(req: Request) {
  const me = await getActiveSessionUserId();
  if (!me) return NextResponse.json({ error: "Sign in to send messages" }, { status: 401 });
  if (isMockUserId(me)) return NextResponse.json({ error: "Create an account to send messages" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    const match = await startConversation(me, parsed.data.userId);
    return NextResponse.json({ ok: true, matchId: match.id, status: match.status, state: viewerState(match, me) });
  } catch (err) {
    if (err instanceof SocialError) return NextResponse.json({ error: err.message }, { status: err.status });
    return failFrom(err);
  }
}

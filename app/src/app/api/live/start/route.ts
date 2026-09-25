import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { LiveError, startLive } from "@/lib/live";
import { failFrom } from "@/lib/http";

const schema = z.object({ title: z.string().max(200) });

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to go live" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Going live is not available on the demo account" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give your live a title" }, { status: 400 });
  try {
    const { session, token, url } = await startLive(userId, parsed.data.title);
    return NextResponse.json({ sessionId: session.id, title: session.title, startedAt: session.startedAt, token, url });
  } catch (err) {
    if (err instanceof LiveError) return NextResponse.json({ error: err.message }, { status: err.status });
    return failFrom(err);
  }
}

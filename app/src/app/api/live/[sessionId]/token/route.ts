import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { joinToken, LiveError } from "@/lib/live";
import { failFrom } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to watch lives" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Create an account to watch lives" }, { status: 403 });
  try {
    return NextResponse.json(await joinToken(sessionId, userId));
  } catch (err) {
    if (err instanceof LiveError) return NextResponse.json({ error: err.message }, { status: err.status });
    return failFrom(err);
  }
}

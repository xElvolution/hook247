import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { follow, isFollowing, SocialError, unfollow } from "@/lib/social";
import { failFrom } from "@/lib/http";

const schema = z.object({ userId: z.string().min(1).max(64) });

function fail(err: unknown) {
  if (err instanceof SocialError) return NextResponse.json({ error: err.message }, { status: err.status });
  return failFrom(err);
}

/** Whether you follow someone and whether they follow you. */
export async function GET(req: Request) {
  const me = await getSessionUserId();
  const userId = new URL(req.url).searchParams.get("userId") ?? "";
  if (!me || isMockUserId(me) || !userId) return NextResponse.json({ following: false, followsYou: false });
  try {
    const [following, followsYou] = await Promise.all([isFollowing(me, userId), isFollowing(userId, me)]);
    return NextResponse.json({ following, followsYou }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const me = await getActiveSessionUserId();
  if (!me) return NextResponse.json({ error: "Sign in to follow members" }, { status: 401 });
  if (isMockUserId(me)) return NextResponse.json({ error: "Create an account to follow members" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await follow(me, parsed.data.userId)) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  const me = await getActiveSessionUserId();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(me)) return NextResponse.json({ error: "Create an account to follow members" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await unfollow(me, parsed.data.userId)) });
  } catch (err) {
    return fail(err);
  }
}

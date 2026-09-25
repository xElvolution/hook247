import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { CoinError, sendTip } from "@/lib/coins";
import { VISIBLE_POST } from "@/lib/moderation";
import { failFrom } from "@/lib/http";

const schema = z.object({
  toUserId: z.string().min(1),
  coins: z.number().int().positive(),
  nonce: z.string().min(8).max(64),
  source: z.enum(["profile", "post"]),
  postId: z.string().optional(),
});

/** Send coins to an escort from their profile or one of their posts. */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to send a tip" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Coins are not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose how many coins to send" }, { status: 400 });
  const { toUserId, coins, nonce, source, postId } = parsed.data;

  try {
    if (source === "post") {
      const post = await db.post.findFirst({ where: { AND: [{ id: postId ?? "" }, VISIBLE_POST] }, select: { authorId: true } });
      if (!post || post.authorId !== toUserId) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const result = await sendTip({ fromId: userId, toId: toUserId, coins, nonce, source, postId: postId ?? null });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CoinError) {
      const status = err.code === "INSUFFICIENT" ? 402 : err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return failFrom(err);
  }
}

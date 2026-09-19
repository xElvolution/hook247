import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { VISIBLE_POST } from "@/lib/moderation";
import { isMockUserId, mockToggleLike } from "@/lib/mock";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId } = await params;
  if (isMockUserId(userId)) return NextResponse.json(mockToggleLike(postId));

  // Unlike is always allowed so a like already placed on a since-hidden post
  // can still be withdrawn; only new likes require the post to be visible.
  const existing = await db.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    await db.postLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  const post = await db.post.findFirst({
    where: { AND: [{ id: postId }, VISIBLE_POST] },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await db.postLike.create({ data: { postId, userId } });
  return NextResponse.json({ liked: true });
}

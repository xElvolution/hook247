import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { VISIBLE_POST } from "@/lib/moderation";
import { isMockUserId, mockCurrentUser } from "@/lib/mock";

const schema = z.object({ body: z.string().min(1).max(500) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (isMockUserId(userId)) {
    const me = mockCurrentUser();
    return NextResponse.json({
      comment: {
        id: `mock-c-${Date.now()}`,
        body: parsed.data.body,
        author: me.profile.displayName,
        avatarUrl: me.profile.avatarUrl,
      },
    });
  }

  // A taken-down post is gone as far as the app is concerned, so it cannot
  // collect new comments even if someone still has the id.
  const post = await db.post.findFirst({
    where: { AND: [{ id: postId }, VISIBLE_POST] },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const comment = await db.comment.create({
    data: { postId, authorId: userId, body: parsed.data.body },
    include: { author: { include: { profile: true } } },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      author: comment.author.profile?.displayName ?? "Member",
      avatarUrl: comment.author.profile?.avatarUrl ?? "",
    },
  });
}

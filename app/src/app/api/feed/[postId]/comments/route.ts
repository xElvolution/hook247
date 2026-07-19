import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const schema = z.object({ body: z.string().min(1).max(500) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

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

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId } = await params;
  const existing = await db.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    await db.postLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }
  await db.postLike.create({ data: { postId, userId } });
  return NextResponse.json({ liked: true });
}

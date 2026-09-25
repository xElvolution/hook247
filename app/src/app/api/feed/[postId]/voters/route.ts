import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { failFrom } from "@/lib/http";

/** Who picked what. Only the poll's author can see this. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { postId } = await params;

  try {
    const poll = await db.poll.findUnique({
      where: { postId },
      include: {
        post: { select: { authorId: true } },
        options: {
          orderBy: { position: "asc" },
          include: {
            votes: {
              orderBy: { createdAt: "desc" },
              take: 200,
              include: { user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
            },
          },
        },
      },
    });
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    if (poll.post.authorId !== userId) {
      return NextResponse.json({ error: "Only the author can see voters" }, { status: 403 });
    }

    return NextResponse.json({
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        voters: o.votes.map((v) => ({
          userId: v.user.id,
          displayName: v.user.profile?.displayName ?? "Member",
          avatarUrl: v.user.profile?.avatarUrl ?? "",
          at: v.createdAt,
        })),
      })),
    });
  } catch (err) {
    return failFrom(err);
  }
}

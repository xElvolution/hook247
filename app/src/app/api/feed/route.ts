import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom, getActiveSessionUserId } from "@/lib/user";
import { VISIBLE_POST, VISIBLE_COMMENT, VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockUserId, mockFeed } from "@/lib/mock";

/** Sidebar suggestions: verified and recently-active members come first. */
async function recommendations(excludeUserId: string | null) {
  const profiles = await db.profile.findMany({
    where: excludeUserId
      ? { AND: [VISIBLE_PROFILE, { userId: { not: excludeUserId } }] }
      : VISIBLE_PROFILE,
    orderBy: [{ isLive: "desc" }, { verified: "desc" }, { lastActive: "desc" }],
    take: 7,
  });
  return profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    age: ageFrom(p.birthDate),
    city: p.city,
    avatarUrl: p.avatarUrl,
    verified: p.verified,
    live: p.isLive,
  }));
}

export async function GET() {
  // Guests can read the feed; posting/liking/commenting requires login.
  const userId = await getSessionUserId();
  if (isMockUserId(userId)) {
    return NextResponse.json(mockFeed());
  }

  const [posts, recommended] = await Promise.all([
    db.post.findMany({
      where: VISIBLE_POST,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { include: { profile: true } },
        likes: { select: { userId: true } },
        comments: {
          where: VISIBLE_COMMENT,
          orderBy: { createdAt: "asc" },
          take: 3,
          include: { author: { include: { profile: true } } },
        },
        _count: { select: { likes: true, comments: { where: VISIBLE_COMMENT } } },
      },
    }),
    recommendations(userId),
  ]);

  return NextResponse.json({
    guest: !userId,
    recommended,
    posts: posts.map((p, index) => ({
      id: p.id,
      body: p.body,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      posterUrl: "",
      category: index % 4 === 0 ? "trending" : "explore",
      views: 120 + p._count.likes * 11 + p._count.comments * 7,
      poll: null,
      createdAt: p.createdAt,
      mine: p.authorId === userId,
      author: {
        userId: p.authorId,
        displayName: p.author.profile?.displayName ?? "Member",
        age: p.author.profile ? ageFrom(p.author.profile.birthDate) : null,
        avatarUrl: p.author.profile?.avatarUrl ?? "",
        verified: p.author.profile?.verified ?? false,
      },
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      likedByMe: p.likes.some((l) => l.userId === userId),
      comments: p.comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.author.profile?.displayName ?? "Member",
        avatarUrl: c.author.profile?.avatarUrl ?? "",
      })),
    })),
  });
}

const postSchema = z
  .object({
    body: z.string().max(1000).default(""),
    imageUrl: z.string().url().or(z.string().startsWith("/uploads/")).or(z.literal("")).default(""),
    videoUrl: z.string().url().or(z.string().startsWith("/uploads/")).or(z.literal("")).default(""),
  })
  .refine((data) => !!data.body.trim() || !!data.imageUrl || !!data.videoUrl, {
    message: "Add text, an image, or a video",
  });

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (isMockUserId(userId)) {
    return NextResponse.json({ ok: true, id: `mock-post-${Date.now()}` });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const post = await db.post.create({
    data: {
      authorId: userId,
      body: parsed.data.body.trim(),
      imageUrl: parsed.data.imageUrl,
      videoUrl: parsed.data.videoUrl,
    },
  });
  return NextResponse.json({ ok: true, id: post.id });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom, getActiveSessionUserId } from "@/lib/user";
import { VISIBLE_POST, VISIBLE_COMMENT, VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockUserId, mockFeed } from "@/lib/mock";
import { feedBoards, primaryBoard } from "@/lib/feedBoards";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, pollInclude, serializePoll, voterCounts } from "@/lib/polls";

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
        poll: { include: pollInclude(userId) },
      },
    }),
    recommendations(userId),
  ]);
  const voters = await voterCounts(
    posts.map((p) => p.poll?.id).filter((id): id is string => Boolean(id))
  );

  return NextResponse.json({
    guest: !userId,
    recommended,
    posts: posts.map((p) => {
      const views = p._count.likes * 11 + p._count.comments * 7;
      const boards = feedBoards({
        body: p.body,
        videoUrl: p.videoUrl,
        poll: p.poll,
        storedCategory: p.category,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        views,
      });
      return {
      id: p.id,
      body: p.body,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      posterUrl: "",
      category: primaryBoard(boards),
      boards,
      views,
      poll: p.poll ? serializePoll(p.poll, voters.get(p.poll.id) ?? 0) : null,
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
    };
    }),
  });
}

const pollSchema = z
  .object({
    question: z.string().trim().min(1, "Ask a question").max(200),
    options: z
      .array(z.string().trim().min(1, "Options cannot be empty").max(100))
      .min(POLL_MIN_OPTIONS, `Add at least ${POLL_MIN_OPTIONS} options`)
      .max(POLL_MAX_OPTIONS, `Polls take up to ${POLL_MAX_OPTIONS} options`),
    allowMultiple: z.boolean().default(false),
  })
  .refine(
    (poll) => new Set(poll.options.map((o) => o.toLowerCase())).size === poll.options.length,
    { message: "Each option must be different" }
  );

const postSchema = z
  .object({
    body: z.string().max(1000).default(""),
    imageUrl: z.string().url().or(z.string().startsWith("/uploads/")).or(z.literal("")).default(""),
    videoUrl: z.string().url().or(z.string().startsWith("/uploads/")).or(z.literal("")).default(""),
    poll: pollSchema.optional(),
  })
  .refine((data) => !!data.body.trim() || !!data.imageUrl || !!data.videoUrl || !!data.poll, {
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const body = parsed.data.body.trim();
  const poll = parsed.data.poll;
  const boards = feedBoards({
    body,
    videoUrl: parsed.data.videoUrl,
    poll,
    likeCount: 0,
    commentCount: 0,
  });
  const post = await db.post.create({
    data: {
      authorId: userId,
      body,
      imageUrl: parsed.data.imageUrl,
      videoUrl: parsed.data.videoUrl,
      category: poll ? "poll" : primaryBoard(boards),
      ...(poll
        ? {
            poll: {
              create: {
                question: poll.question,
                allowMultiple: poll.allowMultiple,
                options: {
                  create: poll.options.map((label, position) => ({ label, position })),
                },
              },
            },
          }
        : {}),
    },
  });
  return NextResponse.json({ ok: true, id: post.id });
}

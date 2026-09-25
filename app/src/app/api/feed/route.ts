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

export async function GET(req: Request) {
  // Guests can read the public feed; posting/liking/commenting requires login.
  const userId = await getSessionUserId();
  const erotica = new URL(req.url).searchParams.get("board") === "erotica";
  if (isMockUserId(userId)) {
    return NextResponse.json(erotica ? { ...mockFeed(), posts: [] } : mockFeed());
  }

  // The Erotica board is only served to signed-in members who have confirmed
  // they are 18+. The check is here, not just in the UI, so the posts never
  // reach a browser that has not passed the gate.
  if (erotica) {
    if (!userId) {
      return NextResponse.json({ error: "Sign in to view Erotica", needsLogin: true }, { status: 401 });
    }
    const me = await db.user.findUnique({
      where: { id: userId },
      select: { adultConfirmedAt: true, bannedAt: true },
    });
    if (!me || me.bannedAt) {
      return NextResponse.json({ error: "Sign in to view Erotica", needsLogin: true }, { status: 401 });
    }
    if (!me.adultConfirmedAt) {
      return NextResponse.json({ error: "Confirm you are 18 or older", needsAdultConfirm: true }, { status: 403 });
    }
  }

  const [posts, recommended] = await Promise.all([
    db.post.findMany({
      where: {
        AND: [VISIBLE_POST, erotica ? { category: "erotica" } : { category: { not: "erotica" } }],
      },
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
      explicit: p.category === "erotica",
      poll: p.poll ? serializePoll(p.poll, voters.get(p.poll.id) ?? 0) : null,
      createdAt: p.createdAt,
      mine: p.authorId === userId,
      author: {
        userId: p.authorId,
        displayName: p.author.profile?.displayName ?? "Member",
        age: p.author.profile ? ageFrom(p.author.profile.birthDate) : null,
        avatarUrl: p.author.profile?.avatarUrl ?? "",
        verified: p.author.profile?.verified ?? false,
        tippable: p.author.profile?.role === "ESCORT",
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
    erotica: z.boolean().default(false),
    attest: z.boolean().default(false),
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
  const erotica = parsed.data.erotica;

  if (erotica) {
    if (poll) {
      return NextResponse.json({ error: "Polls cannot be posted to Erotica" }, { status: 400 });
    }
    const author = await db.user.findUnique({
      where: { id: userId },
      select: { profile: { select: { verified: true, birthDate: true } } },
    });
    if (!author?.profile?.verified) {
      return NextResponse.json(
        { error: "Only verified members can post to Erotica. Verify your profile first.", needsVerification: true },
        { status: 403 }
      );
    }
    if (ageFrom(author.profile.birthDate) < 18) {
      return NextResponse.json({ error: "You must be 18 or older to post to Erotica" }, { status: 403 });
    }
    if (!parsed.data.attest) {
      return NextResponse.json(
        { error: "Confirm that you own this content and everyone in it is 18+ and consented" },
        { status: 400 }
      );
    }
  }
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
      category: erotica ? "erotica" : poll ? "poll" : primaryBoard(boards),
      adultAttestedAt: erotica ? new Date() : null,
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

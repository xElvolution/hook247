import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_PROFILES } from "@/lib/demoProfiles";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";

const recommendations = () =>
  DEMO_PROFILES.slice(0, 7).map((profile) => ({
    userId: profile.userId,
    displayName: profile.displayName,
    age: profile.age,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    verified: profile.verified,
    live: profile.live,
  }));

export async function GET() {
  // Guests can read the feed; posting/liking/commenting requires login.
  const userId = await getSessionUserId();

  try {
    const posts = await db.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { include: { profile: true } },
        likes: { select: { userId: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 3,
          include: { author: { include: { profile: true } } },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    return NextResponse.json({
      guest: !userId,
      recommended: recommendations(),
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
  } catch {
    const demoPosts = [
      {
        body: "Lagos after dark has a different energy. I have a few openings this weekend and I am taking dinner recommendations.",
        imageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1400&q=84",
        videoUrl: "",
        posterUrl: "",
        category: "trending",
        views: 1840,
        poll: null,
      },
      {
        body: "A quiet reset before tonight's plans. Going live later from Lekki.",
        imageUrl: "",
        videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        posterUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=82",
        category: "explore",
        views: 1230,
        poll: null,
      },
      {
        body: "Updated my service menu today: massage, dinner dates, and GFE bookings are available. Rates are on my profile.",
        imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=84",
        videoUrl: "",
        posterUrl: "",
        category: "erotica",
        views: 972,
        poll: null,
      },
      {
        body: "Help settle tonight's plan.",
        imageUrl: "",
        videoUrl: "",
        posterUrl: "",
        category: "poll",
        views: 748,
        poll: {
          question: "What makes the better first meeting?",
          options: [
            { label: "Dinner somewhere quiet", votes: 58 },
            { label: "Drinks with live music", votes: 42 },
          ],
        },
      },
      {
        body: "The best conversations start when nobody is rushing. Abuja, what is your ideal evening out?",
        imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=84",
        videoUrl: "",
        posterUrl: "",
        category: "trending",
        views: 2110,
        poll: null,
      },
      {
        body: "New week, new city. Looking forward to meeting good people in Port Harcourt.",
        imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=84",
        videoUrl: "",
        posterUrl: "",
        category: "explore",
        views: 638,
        poll: null,
      },
    ];

    return NextResponse.json({
      guest: !userId,
      demoMode: true,
      recommended: recommendations(),
      posts: DEMO_PROFILES.slice(0, demoPosts.length).map((profile, index) => ({
        id: `demo-post-${index + 1}`,
        ...demoPosts[index],
        createdAt: new Date(Date.now() - index * 60 * 60 * 1000).toISOString(),
        mine: false,
        author: {
          userId: profile.userId,
          displayName: profile.displayName,
          age: profile.age,
          avatarUrl: profile.avatarUrl,
          verified: profile.verified,
        },
        likeCount: 28 + index * 13,
        commentCount: 3 + (index % 4),
        likedByMe: false,
        comments: [
          {
            id: `demo-comment-${index + 1}`,
            body: index % 2 ? "This looks like a good plan." : "The energy is right.",
            author: DEMO_PROFILES[(index + 2) % DEMO_PROFILES.length].displayName,
            avatarUrl: DEMO_PROFILES[(index + 2) % DEMO_PROFILES.length].avatarUrl,
          },
        ],
      })),
    });
  }
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
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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

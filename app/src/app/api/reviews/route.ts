import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";

const schema = z.object({
  listingUserId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(8).max(600),
});

export async function GET(req: Request) {
  const listingUserId = new URL(req.url).searchParams.get("listingUserId") ?? "";
  if (!listingUserId) return NextResponse.json({ reviews: [], average: 0 });
  const rows = await db.listingReview.findMany({
    where: { listingUserId },
    include: { author: { include: { profile: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const average =
    rows.length === 0
      ? 0
      : Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 10) / 10;
  return NextResponse.json({
    average,
    reviews: rows.map((row) => ({
      id: row.id,
      author: row.author.profile?.displayName || row.author.email.split("@")[0],
      rating: row.rating,
      body: row.body,
      date: row.createdAt.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Log in to leave a review." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Add a star rating and at least a short comment." }, { status: 400 });
  }
  if (parsed.data.listingUserId === userId) {
    return NextResponse.json({ error: "You cannot review your own profile." }, { status: 400 });
  }

  const listing = await db.profile.findFirst({
    where: { AND: [VISIBLE_PROFILE, { userId: parsed.data.listingUserId }] },
    select: { userId: true },
  });
  if (!listing) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const review = await db.listingReview.upsert({
    where: {
      listingUserId_authorId: {
        listingUserId: parsed.data.listingUserId,
        authorId: userId,
      },
    },
    create: {
      listingUserId: parsed.data.listingUserId,
      authorId: userId,
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
    update: {
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
  });

  return NextResponse.json({ ok: true, id: review.id });
}

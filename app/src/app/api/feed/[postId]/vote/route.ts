import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { getSessionUserId } from "@/lib/session";
import { VISIBLE_POST } from "@/lib/moderation";
import { loadPollView } from "@/lib/polls";
import { failFrom } from "@/lib/http";

const schema = z.object({ optionIds: z.array(z.string().min(1)).max(12) });

/** Current tallies, used by open poll cards to refresh their bars. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  try {
    const userId = await getSessionUserId();
    const poll = await loadPollView(postId, userId);
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    return NextResponse.json({ poll });
  } catch (err) {
    return failFrom(err);
  }
}

/**
 * Cast, change or retract a vote. The request carries the full set of options
 * the voter wants selected; an empty list removes their vote.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to vote" }, { status: 401 });

  const { postId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  const optionIds = [...new Set(parsed.data.optionIds)];

  try {
    const poll = await db.poll.findFirst({
      where: { postId, post: VISIBLE_POST },
      include: { options: { select: { id: true } } },
    });
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

    const valid = new Set(poll.options.map((o) => o.id));
    if (optionIds.some((id) => !valid.has(id))) {
      return NextResponse.json({ error: "That option is not part of this poll" }, { status: 400 });
    }
    if (!poll.allowMultiple && optionIds.length > 1) {
      return NextResponse.json({ error: "This poll takes one answer" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      // Serialise concurrent taps from the same voter so a single-answer poll
      // can never end up holding two of their votes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${poll.id}:${userId}`}))`;
      await tx.pollVote.deleteMany({ where: { pollId: poll.id, userId } });
      if (optionIds.length) {
        await tx.pollVote.createMany({
          data: optionIds.map((optionId) => ({ pollId: poll.id, optionId, userId })),
          skipDuplicates: true,
        });
      }
    });

    const view = await loadPollView(postId, userId);
    return NextResponse.json({ poll: view });
  } catch (err) {
    return failFrom(err);
  }
}

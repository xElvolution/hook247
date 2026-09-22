import { NextResponse } from "next/server";
import { z } from "zod";
import { ReportReason, ReportStatus, ReportTarget } from "@prisma/client";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";

const schema = z.object({
  targetType: z.nativeEnum(ReportTarget),
  targetId: z.string().min(1),
  reason: z.nativeEnum(ReportReason),
  details: z.string().max(1000).default(""),
});

/**
 * POST /api/report — a member flags a profile, post or comment. The row lands
 * in the admin queue at /502test/reports; nothing is hidden automatically, because
 * auto-hiding on report is a griefing tool.
 */
export async function POST(req: Request) {
  const reporterId = await getActiveSessionUserId();
  if (!reporterId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { targetType, targetId, reason, details } = parsed.data;

  // Resolve the target to the column it belongs in, and confirm it exists —
  // otherwise the queue fills with reports against ids that were never real.
  let targetUserId: string | null = null;
  let targetPostId: string | null = null;
  let targetCommentId: string | null = null;

  if (targetType === ReportTarget.USER) {
    const user = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.id === reporterId) {
      return NextResponse.json(
        { error: "You cannot report yourself." },
        { status: 400 }
      );
    }
    targetUserId = user.id;
  } else if (targetType === ReportTarget.POST) {
    const post = await db.post.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    targetPostId = post.id;
    // Attribute the report to the author too, so a pattern shows up on the
    // account rather than only on scattered individual posts.
    targetUserId = post.authorId;
  } else {
    const comment = await db.comment.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true },
    });
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    targetCommentId = comment.id;
    targetUserId = comment.authorId;
  }

  // One open report per reporter per target. Re-reporting the same thing must
  // not let one person inflate the queue, but a new report is allowed once the
  // previous one has been dealt with.
  const existing = await db.report.findFirst({
    where: {
      reporterId,
      status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      targetType,
      ...(targetPostId
        ? { targetPostId }
        : targetCommentId
          ? { targetCommentId }
          : { targetUserId }),
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      message: "You have already reported this. Our team is reviewing it.",
    });
  }

  await db.report.create({
    data: {
      reporterId,
      targetType,
      targetUserId,
      targetPostId,
      targetCommentId,
      reason,
      details: details.trim(),
    },
  });

  return NextResponse.json({
    ok: true,
    duplicate: false,
    message: "Thanks. Our team will review this.",
  });
}

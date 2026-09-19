import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { issueCode, consumeCode } from "@/lib/verification";

const sendSchema = z.object({ action: z.literal("send") });
const verifySchema = z.object({
  action: z.literal("verify"),
  code: z.string().length(6),
});

/**
 * POST /api/verify-email — send or verify an email confirmation code.
 * The user must already be signed in; this endpoint confirms the address on
 * their account is real.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sendParsed = sendSchema.safeParse(body);
  const verifyParsed = verifySchema.safeParse(body);

  if (!sendParsed.success && !verifyParsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (sendParsed.success) {
    try {
      await issueCode(userId, user.email, "SIGNUP");
      return NextResponse.json({ ok: true, sent: true });
    } catch (err) {
      // issueCode throws on rate-limit; anything else is a mail/transport fault.
      const message =
        err instanceof Error ? err.message : "Could not send the code.";
      const rateLimited = message.includes("Too many codes");
      return NextResponse.json(
        { error: message },
        { status: rateLimited ? 429 : 502 }
      );
    }
  }

  // Narrow explicitly: the guard above proves one of the two parsed, but
  // TypeScript cannot infer that from the early return alone.
  if (!verifyParsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const verified = await consumeCode(user.email, verifyParsed.data.code, "SIGNUP");
  if (!verified) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { emailVerified: true } });
  return NextResponse.json({ ok: true, verified: true });
}

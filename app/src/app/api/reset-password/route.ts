import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueCode, consumeCode } from "@/lib/verification";

const requestSchema = z.object({
  action: z.literal("request"),
  email: z.string().email(),
});

const resetSchema = z.object({
  action: z.literal("reset"),
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/reset-password — issue or consume a password-reset code.
 * Anyone can request a code for any address; the code itself gates the reset.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const requestParsed = requestSchema.safeParse(body);
  const resetParsed = resetSchema.safeParse(body);

  if (!requestParsed.success && !resetParsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (requestParsed.success) {
    const { email } = requestParsed.data;
    const address = email.toLowerCase();
    const user = await db.user.findUnique({ where: { email: address } });
    if (!user) {
      // Silent: don't leak which addresses have accounts.
      return NextResponse.json({ ok: true, sent: true });
    }
    try {
      await issueCode(user.id, address, "RESET");
      return NextResponse.json({ ok: true, sent: true });
    } catch (err) {
      // Rate-limit is a 429; a mail transport failure is a 502.
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
  if (!resetParsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, code, newPassword } = resetParsed.data;
  const address = email.toLowerCase();
  const userId = await consumeCode(address, code, "RESET");
  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  return NextResponse.json({ ok: true, reset: true });
}

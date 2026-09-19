import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import type { VerificationType } from "@prisma/client";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/mailer";

export const CODE_TTL_MINUTES = 10;
const MAX_SENDS_PER_15_MIN = 5;

/** Cryptographically uniform 6-digit code — Math.random is not good enough here. */
function generateCode() {
  return randomInt(100_000, 1_000_000).toString();
}

/**
 * Issue a code and email it. Any earlier unused code of the same type is
 * dropped so only the newest one works. Throws when the address has asked for
 * too many codes recently.
 */
export async function issueCode(
  userId: string,
  email: string,
  type: VerificationType
) {
  const address = email.toLowerCase();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await db.emailVerification.count({
    where: { email: address, type, createdAt: { gte: since } },
  });
  if (recent >= MAX_SENDS_PER_15_MIN) {
    throw new Error("Too many codes requested. Try again in 15 minutes.");
  }

  // Expire earlier codes rather than deleting them: consumeCode ignores expired
  // rows, so only the newest code works, and the rows still count toward the
  // rate limit above. Deleting them would reset the count on every call and the
  // limit would never trigger.
  await db.emailVerification.updateMany({
    where: { userId, type, verified: false, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const code = generateCode();
  await db.emailVerification.create({
    data: {
      userId,
      email: address,
      code,
      type,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  if (type === "SIGNUP") {
    await sendVerificationEmail(address, code, CODE_TTL_MINUTES);
  } else {
    await sendPasswordResetEmail(address, code, CODE_TTL_MINUTES);
  }
}

/**
 * Consume a code. Returns the owning userId on success, null otherwise.
 * The row is marked verified rather than deleted so the same code cannot be
 * replayed against a second request.
 */
export async function consumeCode(
  email: string,
  code: string,
  type: VerificationType
): Promise<string | null> {
  const row = await db.emailVerification.findFirst({
    where: {
      email: email.toLowerCase(),
      code: code.trim(),
      type,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  await db.emailVerification.update({
    where: { id: row.id },
    data: { verified: true },
  });
  return row.userId;
}

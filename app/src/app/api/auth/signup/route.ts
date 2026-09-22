import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { failFrom } from "@/lib/http";
import { createSession } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { issueCode } from "@/lib/verification";
import { resolveReferrerId, uniqueReferralCode } from "@/lib/referrals";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
    birthDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
    referralCode: z.string().max(16).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { email, password, birthDate, referralCode } = parsed.data;

    if (ageFrom(new Date(birthDate)) < 18) {
      return NextResponse.json(
        { error: "You must be 18 or older to join Hooks247." },
        { status: 403 }
      );
    }

    const address = email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email: address } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const referredById = await resolveReferrerId(referralCode);
    const user = await db.user.create({
      data: {
        email: address,
        passwordHash: await bcrypt.hash(password, 10),
        referralCode: await uniqueReferralCode(),
        referredById: referredById === null ? undefined : referredById,
      },
    });

    // The session starts here so onboarding can continue immediately; the code
    // gates the parts of the app that need a trusted address.
    await createSession(user.id);

    try {
      await issueCode(user.id, address, "SIGNUP");
    } catch (err) {
      // The account exists and is usable — surface the mail failure without
      // rolling it back so the user can retry from /verify-email.
      console.error("Signup verification mail failed:", err);
      return NextResponse.json({
        ok: true,
        birthDate,
        emailSent: false,
        message: "Account created, but we could not send the code. Retry from the verification page.",
      });
    }

    return NextResponse.json({ ok: true, birthDate, emailSent: true });
  } catch (err) {
    return failFrom(err);
  }
}

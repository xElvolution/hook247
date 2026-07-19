import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ageFrom } from "@/lib/user";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  birthDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, password, birthDate } = parsed.data;

  if (ageFrom(new Date(birthDate)) < 18) {
    return NextResponse.json(
      { error: "You must be 18 or older to join Hook247." },
      { status: 403 }
    );
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true, birthDate });
}

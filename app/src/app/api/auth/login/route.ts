import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { failFrom } from "@/lib/http";
import { createSession } from "@/lib/session";
import { standing, standingMessage } from "@/lib/moderation";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    // Checked after the password so a wrong password on a banned account still
    // answers "incorrect email or password" — the ban is not an oracle for
    // whether an address is registered.
    const status = standing(user);
    if (!status.ok) {
      return NextResponse.json({ error: standingMessage(status) }, { status: 403 });
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true, hasProfile: !!user.profile });
  } catch (err) {
    return failFrom(err);
  }
}

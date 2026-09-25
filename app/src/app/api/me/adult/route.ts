import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom, getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { failFrom } from "@/lib/http";

/** Whether the member has passed the 18+ gate, and whether they may post explicit content. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ signedIn: false, confirmed: false, canPost: false });
  if (isMockUserId(userId)) return NextResponse.json({ signedIn: true, confirmed: false, canPost: false });
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { adultConfirmedAt: true, profile: { select: { verified: true } } },
    });
    return NextResponse.json({
      signedIn: !!user,
      confirmed: !!user?.adultConfirmedAt,
      confirmedAt: user?.adultConfirmedAt ?? null,
      canPost: !!user?.profile?.verified,
    });
  } catch (err) {
    return failFrom(err);
  }
}

/** Record the one-time 18+ confirmation. The first timestamp is kept. */
export async function POST() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { adultConfirmedAt: true, profile: { select: { birthDate: true } } },
    });
    if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    if (user.profile && ageFrom(user.profile.birthDate) < 18) {
      return NextResponse.json({ error: "Erotica is for members aged 18 and over" }, { status: 403 });
    }
    if (!user.adultConfirmedAt) {
      await db.user.updateMany({
        where: { id: userId, adultConfirmedAt: null },
        data: { adultConfirmedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, confirmed: true });
  } catch (err) {
    return failFrom(err);
  }
}

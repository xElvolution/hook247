import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Stubbed billing: in production this endpoint would be replaced by a
// Paystack/Stripe checkout + webhook. Here it flips the plan directly.
const schema = z.object({
  action: z.enum(["upgrade", "boost", "verify"]),
  plan: z.enum(["PLUS", "ELITE"]).optional(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { action, plan } = parsed.data;

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  if (action === "upgrade") {
    if (!plan) return NextResponse.json({ error: "Plan required" }, { status: 400 });
    const updated = await db.profile.update({ where: { userId }, data: { plan } });
    return NextResponse.json({ ok: true, plan: updated.plan });
  }

  if (action === "boost") {
    if (profile.plan === "FREE") {
      return NextResponse.json(
        { error: "Boost is a Plus/Elite feature. Upgrade to boost your profile." },
        { status: 403 }
      );
    }
    await db.profile.update({ where: { userId }, data: { boostedAt: new Date() } });
    return NextResponse.json({ ok: true, boosted: true });
  }

  // action === "verify" — stub for a real ID/selfie verification flow
  await db.profile.update({ where: { userId }, data: { verified: true } });
  return NextResponse.json({ ok: true, verified: true });
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { initializeTransaction } from "@/lib/paystack";
import { requestAppUrl } from "@/lib/publicUrl";
import { ensureCatalog, isSubscriptionActive } from "@/lib/money";

const schema = z.object({
  action: z.enum(["checkout"]),
  kind: z.enum(["plan", "boost"]),
  productId: z.string().min(1),
});

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await ensureCatalog();
  const profile = await db.profile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 400 });
  }

  let amountKobo = 0;
  let purpose: "SUBSCRIPTION" | "BOOST" = "SUBSCRIPTION";
  let label = "plan";

  if (parsed.data.kind === "plan") {
    const plan = await db.subscriptionPlan.findFirst({
      where: { id: parsed.data.productId, active: true },
    });
    if (!plan) return NextResponse.json({ error: "Plan not available" }, { status: 400 });
    amountKobo = plan.priceKobo;
    purpose = "SUBSCRIPTION";
    label = plan.slug;
  } else {
    if (!isSubscriptionActive(profile.subscriptionExpiresAt)) {
      return NextResponse.json(
        { error: "Buy a profile plan before boosting." },
        { status: 403 }
      );
    }
    const boost = await db.boostProduct.findFirst({
      where: { id: parsed.data.productId, active: true },
    });
    if (!boost) return NextResponse.json({ error: "Boost not available" }, { status: 400 });
    amountKobo = boost.priceKobo;
    purpose = "BOOST";
    label = boost.slug;
  }

  const reference = `hook247_${label}_${randomUUID()}`;
  const payment = await db.payment.create({
    data: {
      userId,
      reference,
      purpose,
      productId: parsed.data.productId,
      amountKobo,
      status: "PENDING",
    },
  });

  const appUrl = requestAppUrl(req);
  const callbackUrl = `${appUrl}/premium`;

  try {
    const init = await initializeTransaction(
      profile.user.email,
      amountKobo,
      reference,
      callbackUrl
    );
    return NextResponse.json({
      checkoutUrl: init.authorization_url,
      reference: init.reference,
    });
  } catch (err) {
    console.error("Paystack initialize failed:", err);
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: "Could not reach Paystack. Please try again." },
      { status: 502 }
    );
  }
}

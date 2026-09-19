import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { initializeTransaction, PAYSTACK_PUBLIC_KEY } from "@/lib/paystack";

const PRICES = {
  PLAN_PLUS: 250_000, // ₦2,500 in kobo
  PLAN_ELITE: 600_000, // ₦6,000 in kobo
  BOOST: 150_000, // ₦1,500 in kobo (requires Plus/Elite)
  VERIFICATION: 200_000, // ₦2,000 in kobo
} as const;

const schema = z.object({
  action: z.enum(["checkout"]),
  purpose: z.enum(["PLAN_PLUS", "PLAN_ELITE", "BOOST", "VERIFICATION"]),
});

/**
 * POST /api/premium — create a Paystack checkout session.
 * The user is redirected to Paystack to pay. Paystack then hits our webhook
 * which fulfills the purchase and marks the Payment row SUCCESS.
 */
export async function POST(req: Request) {
  // A banned account must not be able to start a checkout — taking money for a
  // benefit it cannot use would mean issuing a refund later.
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { purpose } = parsed.data;

  const profile = await db.profile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 400 });
  }

  // Boost requires Plus or Elite.
  if (purpose === "BOOST" && profile.plan === "FREE") {
    return NextResponse.json(
      { error: "Boost is a Plus/Elite feature. Upgrade first." },
      { status: 403 }
    );
  }

  const amountKobo = PRICES[purpose];
  const reference = `hook247_${purpose.toLowerCase()}_${randomUUID()}`;

  // Create the pending Payment row before redirecting to Paystack.
  const payment = await db.payment.create({
    data: {
      userId,
      reference,
      purpose,
      amountKobo,
      status: "PENDING",
    },
  });

  // Initialize the transaction with Paystack.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const callbackUrl = `${appUrl}/premium?status=success&reference=${reference}`;

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
    // Paystack never saw this reference, so the row would sit PENDING forever.
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

/** GET /api/premium — return Paystack public key for client-side SDK. */
export async function GET() {
  return NextResponse.json({ publicKey: PAYSTACK_PUBLIC_KEY });
}

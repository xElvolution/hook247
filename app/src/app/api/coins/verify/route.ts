import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { fulfilCoinPurchase, isCoinReference } from "@/lib/coinPurchases";
import { getWallet } from "@/lib/coins";
import { failFrom } from "@/lib/http";

const schema = z.object({ reference: z.string().min(8).max(120) });

/** Called when Paystack sends the buyer back to /coins. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isCoinReference(parsed.data.reference)) {
    return NextResponse.json({ error: "Unknown payment" }, { status: 400 });
  }
  try {
    const purchase = await db.coinPurchase.findUnique({
      where: { reference: parsed.data.reference },
      select: { userId: true },
    });
    if (!purchase || purchase.userId !== userId) {
      return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
    }
    const result = await fulfilCoinPurchase(parsed.data.reference);
    const wallet = await getWallet(userId);
    return NextResponse.json({ ...result, wallet });
  } catch (err) {
    return failFrom(err);
  }
}

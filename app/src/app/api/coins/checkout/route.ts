import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { initializeTransaction } from "@/lib/paystack";
import { requestAppUrl } from "@/lib/publicUrl";
import { COIN_REFERENCE_PREFIX } from "@/lib/coinPurchases";
import { coinPrice, ensureCoinCatalog, getCoinSettings } from "@/lib/coins";
import { failFrom } from "@/lib/http";

const schema = z.object({ packId: z.string().min(1) });

/** Start a Paystack checkout for a coin pack. */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to buy coins" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Coins are not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a coin pack" }, { status: 400 });

  try {
    await ensureCoinCatalog();
    const [pack, user, settings] = await Promise.all([
      db.coinPack.findFirst({ where: { id: parsed.data.packId, active: true } }),
      db.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { role: true } } } }),
      getCoinSettings(),
    ]);
    if (!pack) return NextResponse.json({ error: "That pack is no longer available" }, { status: 400 });
    if (!user) return NextResponse.json({ error: "Sign in to buy coins" }, { status: 401 });
    if (user.profile?.role === "ESCORT") {
      return NextResponse.json({ error: "Escort accounts earn from gifts and do not need coins." }, { status: 403 });
    }
    // Always coins x the fixed coin price, never a stored figure.
    const amountKobo = pack.coins * coinPrice(settings);

    const reference = `${COIN_REFERENCE_PREFIX}${randomUUID()}`;
    const purchase = await db.coinPurchase.create({
      data: { userId, packId: pack.id, coins: pack.coins, amountKobo, reference },
    });

    try {
      const init = await initializeTransaction(user.email, amountKobo, reference, `${requestAppUrl(req)}/coins`);
      return NextResponse.json({ checkoutUrl: init.authorization_url, reference });
    } catch (err) {
      console.error("Coin checkout init failed:", err);
      await db.coinPurchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });
      return NextResponse.json({ error: "Could not reach Paystack. Please try again." }, { status: 502 });
    }
  } catch (err) {
    return failFrom(err);
  }
}

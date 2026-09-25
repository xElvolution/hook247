import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { CoinError, quoteWithdrawal } from "@/lib/coins";
import { failFrom } from "@/lib/http";

const schema = z.object({ coins: z.number().int().positive() });

/**
 * What a withdrawal would pay, for the confirm step. This is the only place an
 * escort sees the naira value of coins; the request itself recomputes the same
 * figure and refuses to go ahead if it no longer matches what was confirmed.
 */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter how many coins to withdraw" }, { status: 400 });

  try {
    const quote = await quoteWithdrawal(userId, parsed.data.coins);
    return NextResponse.json(
      { coins: quote.coins, amountKobo: quote.amountKobo, balance: quote.balance },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof CoinError) {
      const status = err.code === "INSUFFICIENT" ? 402 : err.code === "NOT_ALLOWED" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return failFrom(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { CoinError } from "@/lib/coins";
import { quoteEarningsWithdrawal } from "@/lib/earnings";
import { failFrom } from "@/lib/http";
import { coinErrorResponse } from "@/lib/coinHttp";

const schema = z.object({ amountKobo: z.number().int().positive() });

/**
 * Amount, fee and what reaches the bank, for the confirm step. The request
 * recomputes the same figures and refuses to go ahead if they changed.
 */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter an amount to withdraw" }, { status: 400 });

  try {
    const quote = await quoteEarningsWithdrawal(userId, parsed.data.amountKobo);
    return NextResponse.json(quote, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof CoinError) return coinErrorResponse(err);
    return failFrom(err);
  }
}

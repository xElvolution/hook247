import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { CoinError } from "@/lib/coins";
import { quoteEarningsWithdrawal, requestEarningsWithdrawal } from "@/lib/earnings";
import { failFrom } from "@/lib/http";
import { coinErrorResponse } from "@/lib/coinHttp";

const schema = z.object({
  amountKobo: z.number().int().positive(),
  accountId: z.string().min(1),
  expectedFeeKobo: z.number().int().nonnegative(),
  expectedPayoutKobo: z.number().int().positive(),
});

/** Escort withdraws from their Earnings Wallet to one of their saved accounts. */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the amount and account" }, { status: 400 });
  const { amountKobo, accountId, expectedFeeKobo, expectedPayoutKobo } = parsed.data;

  try {
    const result = await requestEarningsWithdrawal({ userId, grossKobo: amountKobo, accountId, expectedFeeKobo, expectedPayoutKobo });
    return NextResponse.json({
      ok: true,
      balanceKobo: result.balanceKobo,
      withdrawalId: result.withdrawal.id,
      grossKobo: result.withdrawal.grossKobo,
      feeKobo: result.withdrawal.feeKobo,
      payoutKobo: result.withdrawal.amountKobo,
      status: result.withdrawal.status,
      accountName: result.withdrawal.accountName,
    });
  } catch (err) {
    if (err instanceof CoinError) {
      if (err.code === "CHANGED") {
        const quote = await quoteEarningsWithdrawal(userId, amountKobo).catch(() => null);
        return NextResponse.json({ error: err.message, code: err.code, quote }, { status: 409 });
      }
      return coinErrorResponse(err);
    }
    return failFrom(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { listBanks, resolveAccount } from "@/lib/paystack";
import { CoinError, requestWithdrawal } from "@/lib/coins";
import { failFrom } from "@/lib/http";

const schema = z.object({
  coins: z.number().int().positive(),
  bankCode: z.string().min(2).max(20),
  accountNumber: z.string().regex(/^\d{10}$/, "Account numbers are 10 digits"),
});

/**
 * Escort asks to cash out coins. The account name is resolved again here
 * rather than trusted from the browser, then the coins move from the balance
 * into `held` until an admin pays or rejects the request.
 */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Not available on the demo account" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the withdrawal details" }, { status: 400 });
  }
  const { coins, bankCode, accountNumber } = parsed.data;

  try {
    const profile = await db.profile.findUnique({ where: { userId }, select: { role: true } });
    if (profile?.role !== "ESCORT") return NextResponse.json({ error: "Withdrawals are for escort accounts" }, { status: 403 });

    let bankName = "";
    let accountName = "";
    try {
      const [banks, account] = await Promise.all([listBanks(), resolveAccount(accountNumber, bankCode)]);
      bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
      accountName = account.accountName;
    } catch {
      return NextResponse.json({ error: "We could not confirm that bank account. Check the details." }, { status: 422 });
    }
    if (!bankName || !accountName) {
      return NextResponse.json({ error: "We could not confirm that bank account. Check the details." }, { status: 422 });
    }

    const result = await requestWithdrawal({ userId, coins, bankCode, bankName, accountNumber, accountName });
    await db.payoutAccount.upsert({
      where: { userId },
      create: { userId, bankCode, bankName, accountNumber, accountName },
      update: { bankCode, bankName, accountNumber, accountName, recipientCode: "" },
    });
    return NextResponse.json({ ok: true, balance: result.balance, withdrawalId: result.withdrawal.id });
  } catch (err) {
    if (err instanceof CoinError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "INSUFFICIENT" ? 402 : 400 });
    }
    return failFrom(err);
  }
}

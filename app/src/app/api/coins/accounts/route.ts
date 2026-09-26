import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { isMockUserId } from "@/lib/mock";
import { CoinError } from "@/lib/coins";
import { listBanks, resolveAccount } from "@/lib/paystack";
import {
  listWithdrawalAccounts,
  removeWithdrawalAccount,
  saveWithdrawalAccount,
  setDefaultWithdrawalAccount,
} from "@/lib/earnings";
import { failFrom } from "@/lib/http";
import { coinErrorResponse } from "@/lib/coinHttp";

async function escortId() {
  const userId = await getActiveSessionUserId();
  if (!userId) return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  if (isMockUserId(userId)) return { error: NextResponse.json({ error: "Not available on the demo account" }, { status: 403 }) };
  const profile = await db.profile.findUnique({ where: { userId }, select: { role: true } });
  if (profile?.role !== "ESCORT") {
    return { error: NextResponse.json({ error: "Withdrawal accounts are for escort accounts" }, { status: 403 }) };
  }
  return { userId };
}

function shape(a: Awaited<ReturnType<typeof listWithdrawalAccounts>>[number]) {
  return {
    id: a.id,
    bankCode: a.bankCode,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    accountName: a.accountName,
    isDefault: a.isDefault,
  };
}

export async function GET() {
  const auth = await escortId();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ accounts: (await listWithdrawalAccounts(auth.userId)).map(shape) });
  } catch (err) {
    return failFrom(err);
  }
}

const addSchema = z.object({
  bankCode: z.string().min(2).max(20),
  accountNumber: z.string().regex(/^\d{10}$/, "Account numbers are 10 digits"),
});

/** Save a bank account. The name always comes from the bank, never from the form. */
export async function POST(req: Request) {
  const auth = await escortId();
  if (auth.error) return auth.error;
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the account details" }, { status: 400 });
  }
  const { bankCode, accountNumber } = parsed.data;
  let bankName = "";
  let accountName = "";
  try {
    const [banks, account] = await Promise.all([listBanks(), resolveAccount(accountNumber, bankCode)]);
    bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
    accountName = account.accountName;
  } catch {
    return NextResponse.json({ error: "We could not confirm that bank account. Check the number and bank." }, { status: 422 });
  }
  if (!bankName || !accountName) {
    return NextResponse.json({ error: "We could not confirm that bank account. Check the number and bank." }, { status: 422 });
  }
  try {
    const account = await saveWithdrawalAccount({ userId: auth.userId, bankCode, bankName, accountNumber, accountName });
    return NextResponse.json({ account: shape(account) });
  } catch (err) {
    if (err instanceof CoinError) return coinErrorResponse(err);
    return failFrom(err);
  }
}

const idSchema = z.object({ accountId: z.string().min(1) });

/** Make an account the default for withdrawals. */
export async function PATCH(req: Request) {
  const auth = await escortId();
  if (auth.error) return auth.error;
  const parsed = idSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an account" }, { status: 400 });
  try {
    await setDefaultWithdrawalAccount(auth.userId, parsed.data.accountId);
    return NextResponse.json({ accounts: (await listWithdrawalAccounts(auth.userId)).map(shape) });
  } catch (err) {
    if (err instanceof CoinError) return coinErrorResponse(err);
    return failFrom(err);
  }
}

export async function DELETE(req: Request) {
  const auth = await escortId();
  if (auth.error) return auth.error;
  const parsed = idSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an account" }, { status: 400 });
  try {
    await removeWithdrawalAccount(auth.userId, parsed.data.accountId);
    return NextResponse.json({ accounts: (await listWithdrawalAccounts(auth.userId)).map(shape) });
  } catch (err) {
    if (err instanceof CoinError) return coinErrorResponse(err);
    return failFrom(err);
  }
}

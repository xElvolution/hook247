import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { resolveAccount } from "@/lib/paystack";

const schema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/, "Account numbers are 10 digits"),
  bankCode: z.string().min(2).max(20),
});

/** Look up the account name so the escort can confirm it before withdrawing. */
export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const profile = await db.profile.findUnique({ where: { userId }, select: { role: true } });
  if (profile?.role !== "ESCORT") return NextResponse.json({ error: "Withdrawals are for escort accounts" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the account details" }, { status: 400 });
  }
  try {
    const account = await resolveAccount(parsed.data.accountNumber, parsed.data.bankCode);
    return NextResponse.json({ accountName: account.accountName });
  } catch {
    return NextResponse.json({ error: "We could not find that account. Check the number and bank." }, { status: 422 });
  }
}

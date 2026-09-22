import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { availableCommissionKobo, getSettings, nairaFromKobo, settleCommissions } from "@/lib/money";

const schema = z.object({
  amountKobo: z.number().int().positive(),
  accountName: z.string().min(2).max(80),
  accountNumber: z.string().min(8).max(20),
  bankName: z.string().min(2).max(80),
});

export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rows = await db.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    withdrawals: rows.map((row) => ({
      ...row,
      amountLabel: nairaFromKobo(row.amountKobo),
    })),
  });
}

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Fill account name, number, bank and amount." }, { status: 400 });
  }

  await settleCommissions();
  const settings = await getSettings();
  if (parsed.data.amountKobo < settings.minWithdrawalKobo) {
    return NextResponse.json(
      { error: `Minimum withdrawal is ${nairaFromKobo(settings.minWithdrawalKobo)}.` },
      { status: 400 }
    );
  }

  const available = await availableCommissionKobo(userId);
  if (parsed.data.amountKobo > available) {
    return NextResponse.json({ error: "Not enough available commission." }, { status: 400 });
  }

  const row = await db.withdrawal.create({
    data: {
      userId,
      amountKobo: parsed.data.amountKobo,
      accountName: parsed.data.accountName.trim(),
      accountNumber: parsed.data.accountNumber.trim(),
      bankName: parsed.data.bankName.trim(),
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

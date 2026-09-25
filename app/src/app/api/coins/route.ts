import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { activePacks, getCoinSettings, getWallet } from "@/lib/coins";
import { failFrom } from "@/lib/http";

/** Everything the Coins page needs in one round trip. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to use coins" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "Coins are not available on the demo account" }, { status: 403 });

  try {
    const [wallet, packs, settings, profile, transactions, withdrawals, payout] = await Promise.all([
      getWallet(userId),
      activePacks(),
      getCoinSettings(),
      db.profile.findUnique({ where: { userId }, select: { role: true, displayName: true } }),
      db.coinTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.coinWithdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.payoutAccount.findUnique({ where: { userId } }),
    ]);

    const names = new Map<string, string>();
    const counterpartIds = [...new Set(transactions.map((t) => t.counterpartyId).filter((id): id is string => !!id))];
    if (counterpartIds.length) {
      const profiles = await db.profile.findMany({
        where: { userId: { in: counterpartIds } },
        select: { userId: true, displayName: true },
      });
      for (const p of profiles) names.set(p.userId, p.displayName);
    }

    const isEscort = profile?.role === "ESCORT";
    return NextResponse.json({
      wallet,
      isEscort,
      packs: packs.map((p) => ({ id: p.id, name: p.name, coins: p.coins, priceKobo: p.priceKobo })),
      // The payout rate is deliberately left out: escorts only see what they will
      // receive in the quote shown when they confirm a withdrawal.
      settings: isEscort ? { minWithdrawalCoins: settings.minWithdrawalCoins } : null,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        counterparty: t.counterpartyId ? names.get(t.counterpartyId) ?? "Member" : null,
        source: t.source,
        note: t.note,
        at: t.createdAt,
      })),
      withdrawals: isEscort
        ? withdrawals.map((w) => ({
            id: w.id,
            coins: w.coins,
            amountKobo: w.amountKobo,
            status: w.status,
            bankName: w.bankName,
            accountNumber: w.accountNumber,
            accountName: w.accountName,
            adminNote: w.adminNote,
            at: w.createdAt,
            resolvedAt: w.resolvedAt,
          }))
        : [],
      payoutAccount:
        isEscort && payout
          ? { bankCode: payout.bankCode, bankName: payout.bankName, accountNumber: payout.accountNumber, accountName: payout.accountName }
          : null,
    });
  } catch (err) {
    return failFrom(err);
  }
}

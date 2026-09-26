import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { activePacks, coinPrice, getCoinSettings, getWallet } from "@/lib/coins";
import { getEarningsSummary, listWithdrawalAccounts } from "@/lib/earnings";
import { earnerStatus } from "@/lib/eligibility";
import { failFrom } from "@/lib/http";

async function namesFor(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Map<string, { name: string; avatarUrl: string }>();
  const profiles = await db.profile.findMany({
    where: { userId: { in: unique } },
    select: { userId: true, displayName: true, avatarUrl: true },
  });
  return new Map(profiles.map((p) => [p.userId, { name: p.displayName, avatarUrl: p.avatarUrl }]));
}

/**
 * Everything the wallet page needs in one round trip. Clients get their Coin
 * Wallet, purchases and gifts sent; escorts get their Earnings Wallet, gifts
 * received, saved withdrawal accounts and withdrawals.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to use your wallet" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ error: "The wallet is not available on the demo account" }, { status: 403 });

  try {
    const [status, settings, wallet] = await Promise.all([earnerStatus(userId), getCoinSettings(), getWallet(userId)]);
    if (!status) return NextResponse.json({ error: "Sign in to use your wallet" }, { status: 401 });
    const price = coinPrice(settings);

    if (status.isEscort) {
      const [earnings, received, accounts, withdrawals] = await Promise.all([
        getEarningsSummary(userId),
        db.ledgerEntry.findMany({ where: { kind: "GIFT", receiverId: userId }, orderBy: { createdAt: "desc" }, take: 60 }),
        listWithdrawalAccounts(userId),
        db.coinWithdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
      ]);
      const names = await namesFor(received.map((r) => r.senderId));
      return NextResponse.json({
        role: "ESCORT",
        coinPriceKobo: price,
        eligibility: {
          paid: status.paid,
          planExpiresAt: status.planExpiresAt,
          payoutsFrozen: status.payoutsFrozen,
          giftingDisabled: status.giftingDisabled,
        },
        feeBps: settings.withdrawalFeeBps,
        manualApproval: settings.manualWithdrawalApproval,
        earnings,
        legacyCoins: wallet.balance,
        giftsReceived: received.map((r) => ({
          id: r.id,
          from: r.senderId ? names.get(r.senderId)?.name ?? "Member" : "Member",
          fromAvatar: r.senderId ? names.get(r.senderId)?.avatarUrl ?? "" : "",
          giftName: r.giftName,
          emoji: r.giftEmoji,
          coins: r.coins,
          amountKobo: r.amountKobo,
          shareKobo: r.escortShareKobo,
          source: r.source,
          status: r.status,
          at: r.createdAt,
        })),
        accounts: accounts.map((a) => ({
          id: a.id,
          bankCode: a.bankCode,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          isDefault: a.isDefault,
        })),
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          source: w.source,
          coins: w.coins,
          grossKobo: w.source === "earnings" ? w.grossKobo : w.amountKobo,
          feeKobo: w.feeKobo,
          payoutKobo: w.amountKobo,
          status: w.status,
          bankName: w.bankName,
          accountNumber: w.accountNumber,
          accountName: w.accountName,
          adminNote: w.adminNote,
          at: w.createdAt,
          resolvedAt: w.resolvedAt,
        })),
      });
    }

    const [packs, purchases, sent] = await Promise.all([
      activePacks(),
      db.coinPurchase.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 40 }),
      db.ledgerEntry.findMany({ where: { kind: "GIFT", senderId: userId }, orderBy: { createdAt: "desc" }, take: 60 }),
    ]);
    const names = await namesFor(sent.map((s) => s.receiverId));
    return NextResponse.json({
      role: "CLIENT",
      coinPriceKobo: price,
      wallet: { balance: wallet.balance },
      packs: packs.map((p) => ({ id: p.id, name: p.name, coins: p.coins, priceKobo: p.priceKobo })),
      purchases: purchases.map((p) => ({
        id: p.id,
        coins: p.coins,
        amountKobo: p.amountKobo,
        status: p.status,
        reference: p.reference,
        at: p.createdAt,
      })),
      giftsSent: sent.map((s) => ({
        id: s.id,
        to: s.receiverId ? names.get(s.receiverId)?.name ?? "Member" : "Member",
        toAvatar: s.receiverId ? names.get(s.receiverId)?.avatarUrl ?? "" : "",
        giftName: s.giftName,
        emoji: s.giftEmoji,
        coins: s.coins,
        source: s.source,
        status: s.status,
        at: s.createdAt,
      })),
    });
  } catch (err) {
    return failFrom(err);
  }
}

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { getWallet } from "@/lib/coins";
import { failFrom } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (isMockUserId(userId)) return NextResponse.json({ balance: 0 });
  try {
    const wallet = await getWallet(userId);
    return NextResponse.json({ balance: wallet.balance });
  } catch (err) {
    return failFrom(err);
  }
}

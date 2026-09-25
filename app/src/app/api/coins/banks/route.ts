import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { listBanks } from "@/lib/paystack";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    return NextResponse.json({ banks: await listBanks() });
  } catch (err) {
    console.error("Bank list failed:", err);
    return NextResponse.json({ error: "Could not load banks. Try again shortly." }, { status: 502 });
  }
}

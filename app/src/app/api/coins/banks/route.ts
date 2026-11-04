import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { listBanks } from "@/lib/korapay";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    return NextResponse.json({ banks: await listBanks() });
  } catch (err) {
    console.error("Korapay bank list failed:", (err as Error).message);
    return NextResponse.json({ error: "Could not load banks. Try again shortly." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { guestRewardNotice, welcomeNotice } from "@/lib/welcome";

export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) {
    try {
      return NextResponse.json(await guestRewardNotice());
    } catch {
      return NextResponse.json({ show: false });
    }
  }
  try {
    return NextResponse.json(await welcomeNotice(userId));
  } catch (err) {
    console.error("Welcome notice failed:", (err as Error).message);
    return NextResponse.json({ show: false });
  }
}

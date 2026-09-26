import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isMockUserId } from "@/lib/mock";
import { unseenFollowers } from "@/lib/social";

/** New followers since you last opened the list, for the menu badge. */
export async function GET() {
  const me = await getSessionUserId();
  if (!me || isMockUserId(me)) return NextResponse.json({ count: 0 });
  try {
    return NextResponse.json({ count: await unseenFollowers(me) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

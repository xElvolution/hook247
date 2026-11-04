import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { welcomeDashboard } from "@/lib/welcome";
import { failFrom } from "@/lib/http";

export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const welcome = await welcomeDashboard(userId);
    if (!welcome) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, welcome });
  } catch (err) {
    return failFrom(err);
  }
}

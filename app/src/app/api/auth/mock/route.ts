import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { MOCK_USER_ID, mockLoginEnabled } from "@/lib/mock";

export async function POST() {
  if (!mockLoginEnabled()) {
    return NextResponse.json({ error: "Demo login is off." }, { status: 404 });
  }
  await createSession(MOCK_USER_ID);
  return NextResponse.json({ ok: true, hasProfile: true, mock: true });
}
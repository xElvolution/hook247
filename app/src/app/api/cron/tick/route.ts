import { NextResponse } from "next/server";
import { settleCommissions } from "@/lib/money";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  const sent = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret") || "";
  if (!secret || sent !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await settleCommissions();
  return NextResponse.json({ ok: true, settled: true, at: new Date().toISOString() });
}

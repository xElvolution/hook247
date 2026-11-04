import { NextResponse } from "next/server";
import { settleCommissions } from "@/lib/money";
import { reconcileLives } from "@/lib/live";
import { sendPlanReminders } from "@/lib/planReminders";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  const sent = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret") || "";
  if (!secret || sent !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await settleCommissions(true);
  const lives = await reconcileLives(true).catch((err) => {
    console.error("live reconcile", err);
    return { ended: 0 };
  });
  const reminders = await sendPlanReminders().catch((err) => {
    console.error("plan reminders", err);
    return { sent: 0 };
  });
  return NextResponse.json({ ok: true, settled: true, livesEnded: lives.ended, remindersSent: reminders.sent, at: new Date().toISOString() });
}

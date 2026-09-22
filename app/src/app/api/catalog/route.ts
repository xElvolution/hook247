import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalog } from "@/lib/money";

export async function GET() {
  await ensureCatalog();
  const [plans, boosts, settings] = await Promise.all([
    db.subscriptionPlan.findMany({
      where: { active: true, publicVisible: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.boostProduct.findMany({
      where: { active: true, publicVisible: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.platformSettings.findUnique({ where: { id: "default" } }),
  ]);
  return NextResponse.json({ plans, boosts, minWithdrawalKobo: settings?.minWithdrawalKobo ?? 500000 });
}

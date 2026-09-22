import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { fulfilPayment } from "@/lib/fulfilPayment";
import { db } from "@/lib/db";

const schema = z.object({
  reference: z.string().min(8).max(120),
});

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const payment = await db.payment.findUnique({
    where: { reference: parsed.data.reference },
    select: { userId: true },
  });
  if (!payment || payment.userId !== userId) {
    return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
  }

  try {
    const result = await fulfilPayment(parsed.data.reference);
    return NextResponse.json({ ok: result.ok, state: result.state });
  } catch (err) {
    console.error("Payment confirm failed:", err);
    return NextResponse.json({ ok: false, error: "Could not confirm payment." }, { status: 502 });
  }
}

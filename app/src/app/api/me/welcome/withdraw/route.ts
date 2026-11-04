import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { requestWelcomeWithdrawal } from "@/lib/welcome";
import { failFrom } from "@/lib/http";

const schema = z.object({
  accountName: z.string().min(2).max(80),
  accountNumber: z.string().min(10).max(20),
  bankName: z.string().min(2).max(80),
});

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the account name, number and bank." }, { status: 400 });
  try {
    const result = await requestWelcomeWithdrawal(userId, parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failFrom(err);
  }
}

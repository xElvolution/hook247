import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSessionUserId } from "@/lib/user";
import { confirmWelcomePhoneCode, sendWelcomePhoneCode } from "@/lib/welcome";
import { failFrom } from "@/lib/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), phone: z.string().min(7).max(20) }),
  z.object({ action: z.literal("confirm"), code: z.string().min(4).max(8) }),
]);

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the phone number or code." }, { status: 400 });
  try {
    const result = parsed.data.action === "send"
      ? await sendWelcomePhoneCode(userId, parsed.data.phone)
      : await confirmWelcomePhoneCode(userId, parsed.data.code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message) return NextResponse.json({ error: message }, { status: 502 });
    return failFrom(err);
  }
}

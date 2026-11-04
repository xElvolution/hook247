import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { verifyLive } from "@/lib/faceVerify";
import { faceErrorResponse } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

async function frame(form: FormData, key: string) {
  const value = form.get(key);
  if (!(value instanceof File) || value.size === 0 || value.size > 4 * 1024 * 1024) return null;
  const bytes = Buffer.from(await value.arrayBuffer());
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : null;
}

export async function POST(request: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload was interrupted. Try again." }, { status: 400 });
  }
  const [center, first, second] = await Promise.all([frame(form, "center"), frame(form, "first"), frame(form, "second")]);
  if (!center || !first || !second) {
    return NextResponse.json({ error: "The live check didn't finish. Please try again.", code: "frames" }, { status: 400 });
  }
  try {
    const result = await verifyLive(userId, String(form.get("challengeId") ?? ""), { center, first, second }, form.get("blink") === "1");
    return NextResponse.json(result);
  } catch (err) {
    return faceErrorResponse(err);
  }
}

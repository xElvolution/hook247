import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { saveReference } from "@/lib/faceVerify";
import { faceErrorResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload was interrupted. Try again." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  const showOnProfile = form.get("visibility") === "public";
  try {
    const result = await saveReference(userId, Buffer.from(await file.arrayBuffer()), showOnProfile);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return faceErrorResponse(err);
  }
}

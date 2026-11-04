import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { faceStatus } from "@/lib/faceVerify";
import { faceErrorResponse } from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    return NextResponse.json(await faceStatus(userId));
  } catch (err) {
    return faceErrorResponse(err);
  }
}

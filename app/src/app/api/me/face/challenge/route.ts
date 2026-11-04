import { NextResponse } from "next/server";
import { getActiveSessionUserId } from "@/lib/user";
import { issueChallenge } from "@/lib/faceVerify";
import { faceErrorResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST() {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    return NextResponse.json(await issueChallenge(userId));
  } catch (err) {
    return faceErrorResponse(err);
  }
}

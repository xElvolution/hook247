import { NextResponse } from "next/server";
import { FaceError } from "@/lib/faceVerify";

export function faceErrorResponse(err: unknown) {
  if (err instanceof FaceError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("Face verification error:", err);
  return NextResponse.json(
    { error: "Something went wrong on our side. Please try again.", code: "server" },
    { status: 500 }
  );
}

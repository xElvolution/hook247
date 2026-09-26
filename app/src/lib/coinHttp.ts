import { NextResponse } from "next/server";
import type { CoinError } from "@/lib/coins";

/** HTTP status for a wallet error. */
export function coinErrorStatus(code: CoinError["code"]) {
  switch (code) {
    case "INSUFFICIENT":
      return 402;
    case "NOT_FOUND":
      return 404;
    case "NOT_ALLOWED":
    case "NOT_ELIGIBLE":
      return 403;
    case "STATE":
    case "CHANGED":
      return 409;
    default:
      return 400;
  }
}

export function coinErrorResponse(err: CoinError) {
  return NextResponse.json({ error: err.message, code: err.code }, { status: coinErrorStatus(err.code) });
}

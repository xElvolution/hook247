import { NextResponse } from "next/server";

const TRANSIENT = new Set(["P1001", "P1002", "P1017", "P2024"]);

export function failFrom(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  if (code && TRANSIENT.has(code)) {
    return NextResponse.json(
      { error: "The server is waking up. Please try again." },
      { status: 503 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
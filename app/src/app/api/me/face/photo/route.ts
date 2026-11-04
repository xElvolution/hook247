import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { privateDir } from "@/lib/faceVerify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The member's own private reference photo (never served from /public). */
export async function GET() {
  const userId = await getActiveSessionUserId();
  if (!userId) return new NextResponse(null, { status: 401 });
  const row = await db.memberVerification.findUnique({ where: { userId }, select: { faceRefUrl: true } });
  if (!row?.faceRefUrl) return new NextResponse(null, { status: 404 });
  const bytes = await readFile(path.join(privateDir(), path.basename(row.faceRefUrl))).catch(() => null);
  if (!bytes) return new NextResponse(null, { status: 404 });
  const type = row.faceRefUrl.endsWith(".png") ? "image/png" : row.faceRefUrl.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": type, "cache-control": "private, no-store" } });
}

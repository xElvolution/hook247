import crypto from "node:crypto";
import { SignJWT } from "jose";

/** Server-side helpers for the realtime (socket.io) process. */

function secret() {
  return process.env.AUTH_SECRET || "";
}

export function realtimeEnabled() {
  return Boolean(secret()) && process.env.REALTIME_DISABLED !== "1";
}

/** Short-lived token the browser presents when opening its socket. */
export async function realtimeToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(`${secret()}::realtime`));
}

export function realtimePublicUrl() {
  return process.env.REALTIME_PUBLIC_URL || "";
}

function internalSecret() {
  return crypto.createHash("sha256").update(`${secret()}::realtime-internal`).digest("hex");
}

/** Fan an event out to users or the lounge. Never throws: delivery is best effort, data is already stored. */
export async function emitRealtime(target: { userIds?: string[]; room?: "lounge" }, event: string, payload: unknown) {
  if (!realtimeEnabled()) return;
  const base = process.env.REALTIME_INTERNAL_URL || "http://127.0.0.1:3110";
  try {
    await fetch(`${base}/internal/emit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": internalSecret() },
      body: JSON.stringify({ ...target, event, payload }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (err) {
    console.warn("realtime emit failed", (err as Error).message);
  }
}

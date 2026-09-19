import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// A known fallback secret means anyone can forge a session cookie, so in
// production a missing AUTH_SECRET is a hard failure rather than a warning.
const AUTH_SECRET = process.env.AUTH_SECRET ?? "";

if (!AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`."
  );
}
if (!AUTH_SECRET) {
  console.warn(
    "⚠️ AUTH_SECRET is not set — using an insecure development secret."
  );
}

const secret = new TextEncoder().encode(AUTH_SECRET || "hook247-dev-secret");

const COOKIE = "hook247_session";

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

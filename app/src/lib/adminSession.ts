import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/db";

// The admin console lives at /502test and disguises itself as a gateway error, but
// an obscure path is not access control: the URL leaks through server logs,
// referrer headers and browser history. ADMIN_PASSWORD is the actual lock.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "";

// Build-time evaluation means the throw below would break `next build` when
// ADMIN_PASSWORD is missing. During build we allow it to stay empty; at runtime
// the first actual sign-in attempt will fail with "unable to verify" because
// passwordMatches returns false.
if (!ADMIN_PASSWORD && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  console.error(
    "⚠️ ADMIN_PASSWORD is not set. Generate one with `openssl rand -base64 24`."
  );
}

// Derive a separate signing key from AUTH_SECRET so an admin cookie can never
// be produced by (or mistaken for) an ordinary user session token.
const adminSecret = new TextEncoder().encode(
  `${AUTH_SECRET || "hook247-dev-secret"}::admin`
);

const COOKIE = "hook247_ops";
const SESSION_HOURS = 8;

/** Fixed-cost comparison so a wrong password leaks nothing through timing. */
function passwordMatches(candidate: string) {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(ADMIN_PASSWORD, "utf8");
  // timingSafeEqual throws on length mismatch, so hash both sides to a fixed
  // width first — otherwise the length check itself becomes the oracle.
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Failed attempts are tracked in memory per process. This is deliberately not
// in the database: it is a speed bump against online guessing, and a restart
// clearing it is acceptable. A distributed deployment should move this to Redis.
const attempts = new Map<string, { count: number; first: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function attemptsRemaining(ip: string) {
  const entry = attempts.get(ip);
  if (!entry) return MAX_ATTEMPTS;
  if (Date.now() - entry.first > WINDOW_MS) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

function recordFailure(ip: string) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

/**
 * Verify the password and start an admin session. Returns false for both a
 * wrong password and a rate-limited caller so the caller cannot distinguish
 * the two.
 */
export async function signInAdmin(password: string, ip: string) {
  if (attemptsRemaining(ip) <= 0) return false;

  if (!passwordMatches(password)) {
    recordFailure(ip);
    await logAdminAction("admin.signin.failed", "session", ip);
    return false;
  }

  attempts.delete(ip);

  const token = await new SignJWT({ ops: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(adminSecret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    // Strict rather than lax: nothing should ever navigate into the console
    // from another origin, and it blocks cross-site request forgery outright.
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
  });

  await logAdminAction("admin.signin", "session", ip);
  return true;
}

/** True when the caller holds a valid, unexpired admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, adminSecret);
    return payload.ops === true;
  } catch {
    return false;
  }
}

export async function signOutAdmin() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Guard for every admin page and action. Proxy already blocks unauthenticated
 * requests at the edge, but Next's own docs warn that a matcher change or a
 * moved Server Function can silently drop that coverage — so authorization is
 * re-checked here, at the point of use.
 */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  note = ""
) {
  try {
    await db.adminAction.create({
      data: { action, targetType, targetId, note },
    });
  } catch (err) {
    // The audit log must never break the action it is recording.
    console.error("Audit log write failed:", err);
  }
}

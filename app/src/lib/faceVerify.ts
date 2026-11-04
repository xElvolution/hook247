import crypto from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { readFace, similarity, type FaceRead } from "./faceEngine";

/**
 * Face verification (replaces the old Dojah NIN + selfie widget).
 *
 * 1. The member uploads a reference photo and chooses whether it is also shown
 *    on their profile or kept private for verification only.
 * 2. The server issues a random liveness challenge (head-turn order).
 * 3. The browser guides them through it on a live camera (look straight, blink,
 *    turn each way) and sends three still frames captured during the session.
 * 4. The server re-checks everything itself: exactly one face per frame, the
 *    head turns in the challenged order, anti-spoof scores, and that every frame
 *    matches the reference photo. Only then is the verified badge granted.
 */

export const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55);
const TURN_MATCH_THRESHOLD = Number(process.env.FACE_TURN_MATCH_THRESHOLD ?? 0.45);
const TURN_YAW = Number(process.env.FACE_TURN_YAW ?? 0.22);
const CENTER_YAW = 0.18;
const MIN_REAL = Number(process.env.FACE_MIN_REAL ?? 0.25);
const MIN_LIVE = Number(process.env.FACE_MIN_LIVE ?? 0.4);
export const MAX_ATTEMPTS_PER_DAY = Number(process.env.FACE_MAX_ATTEMPTS ?? 6);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type Challenge = { id: string; order: ("left" | "right")[] };

/** Private store: NOT under public/, served only through an authed route. */
export function privateDir() {
  return path.join(process.cwd(), "private", "face");
}

function sniffImage(head: Buffer): "jpg" | "png" | "webp" | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

export class FaceError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

async function attemptsToday(userId: string) {
  const row = await db.memberVerification.findUnique({ where: { userId } });
  if (!row) return { row, used: 0 };
  const fresh = row.faceLastAttemptAt && Date.now() - row.faceLastAttemptAt.getTime() < 24 * 3600 * 1000;
  return { row, used: fresh ? row.faceAttempts : 0 };
}

export async function faceStatus(userId: string) {
  const [{ row, used }, profile] = await Promise.all([
    attemptsToday(userId),
    db.profile.findUnique({ where: { userId }, select: { verified: true, verifiedSource: true } }),
  ]);
  const verified = Boolean(profile?.verified) || row?.livenessState === "PASSED";
  return {
    verified,
    state: verified ? "PASSED" : row?.livenessState ?? "PENDING",
    hasReference: Boolean(row?.faceRefUrl),
    referencePublic: row?.faceRefPublic ?? false,
    lastError: verified ? "" : row?.faceLastError ?? "",
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_DAY - used),
  };
}

/** Step 1: store the reference photo (private), optionally publish it. */
export async function saveReference(userId: string, bytes: Buffer, showOnProfile: boolean) {
  const ext = sniffImage(bytes.subarray(0, 16));
  if (!ext) throw new FaceError("Use a JPG, PNG or WEBP photo.", "bad_type", 415);
  if (bytes.length > 15 * 1024 * 1024) throw new FaceError("Photos must be 15 MB or smaller.", "too_big", 413);

  const read = await readFace(bytes);
  if (read.count === 0) throw new FaceError("We couldn't find a face in that photo. Use a clear, well-lit photo of your face.", "no_face");
  if (read.count > 1) throw new FaceError("That photo has more than one person. Use a photo of just you.", "many_faces");
  if (read.sizeRatio < 0.18) throw new FaceError("Your face is too small in that photo. Use a closer photo.", "too_small");
  if (!read.embedding) throw new FaceError("That photo isn't clear enough. Try a sharper one.", "blurry");

  const dir = privateDir();
  await mkdir(dir, { recursive: true });
  const name = `${userId}-ref-${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), bytes);

  let publicUrl = "";
  if (showOnProfile) {
    const pubDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(pubDir, { recursive: true });
    const pubName = `${crypto.randomUUID()}.${ext}`;
    await copyFile(path.join(dir, name), path.join(pubDir, pubName));
    publicUrl = `/uploads/${pubName}`;
    const profile = await db.profile.findUnique({ where: { userId }, select: { avatarUrl: true, photos: true } });
    if (profile) {
      await db.profile.update({
        where: { userId },
        data: {
          avatarUrl: profile.avatarUrl || publicUrl,
          photos: profile.photos.includes(publicUrl) ? profile.photos : [publicUrl, ...profile.photos].slice(0, 12),
        },
      });
    }
  }

  const data = {
    faceRefUrl: name,
    faceRefPublic: showOnProfile,
    faceLastError: "",
    faceChallenge: "",
    faceChallengeAt: null,
  };
  await db.memberVerification.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { publicUrl };
}

/** Step 2: issue a fresh random challenge. */
export async function issueChallenge(userId: string): Promise<Challenge> {
  const { row, used } = await attemptsToday(userId);
  if (!row?.faceRefUrl) throw new FaceError("Upload your photo first.", "no_reference");
  if (used >= MAX_ATTEMPTS_PER_DAY) {
    throw new FaceError("You've used all your tries for today. Please try again in 24 hours.", "rate_limited", 429);
  }
  const order: ("left" | "right")[] = crypto.randomInt(2) === 0 ? ["left", "right"] : ["right", "left"];
  const challenge = { id: crypto.randomUUID(), order };
  await db.memberVerification.update({
    where: { userId },
    data: { faceChallenge: JSON.stringify(challenge), faceChallengeAt: new Date() },
  });
  return challenge;
}

/**
 * Yaw sign convention is the engine's own and is identical in the browser and
 * here (both run the same model on the raw, un-mirrored camera frame). "left"
 * means the member's own left as shown in the mirrored preview.
 */
export function yawMatches(direction: "left" | "right", yaw: number) {
  return direction === "left" ? yaw <= -TURN_YAW : yaw >= TURN_YAW;
}

type Frames = { center: Buffer; first: Buffer; second: Buffer };

/** Step 3: verify the live frames against the reference. */
export async function verifyLive(userId: string, challengeId: string, frames: Frames, clientBlink: boolean) {
  const { row, used } = await attemptsToday(userId);
  if (!row?.faceRefUrl) throw new FaceError("Upload your photo first.", "no_reference");
  if (used >= MAX_ATTEMPTS_PER_DAY) {
    throw new FaceError("You've used all your tries for today. Please try again in 24 hours.", "rate_limited", 429);
  }
  let challenge: Challenge | null = null;
  try {
    challenge = JSON.parse(row.faceChallenge || "null");
  } catch {
    challenge = null;
  }
  const fresh = row.faceChallengeAt && Date.now() - row.faceChallengeAt.getTime() < CHALLENGE_TTL_MS;
  if (!challenge || challenge.id !== challengeId || !fresh) {
    throw new FaceError("This check timed out. Start the live check again.", "challenge_expired");
  }

  // Burn the challenge and count the attempt before doing any work.
  const lastAttemptFresh = row.faceLastAttemptAt && Date.now() - row.faceLastAttemptAt.getTime() < 24 * 3600 * 1000;
  await db.memberVerification.update({
    where: { userId },
    data: {
      faceChallenge: "",
      faceChallengeAt: null,
      faceAttempts: lastAttemptFresh ? { increment: 1 } : 1,
      faceLastAttemptAt: lastAttemptFresh ? row.faceLastAttemptAt : new Date(),
    },
  });

  const fail = async (message: string, code: string, score?: number) => {
    console.info("face check failed", { code, score, yaw: debugYaw });
    await db.memberVerification.update({
      where: { userId },
      data: { faceLastError: message, livenessState: "FAILED", ...(score !== undefined ? { faceScore: score } : {}) },
    });
    return { passed: false as const, code, message, attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_DAY - used - 1) };
  };

  let debugYaw: number[] = [];
  if (!clientBlink) return fail("We didn't see you blink. Blink naturally when asked.", "no_blink");

  const refBytes = await readFile(path.join(privateDir(), row.faceRefUrl)).catch(() => null);
  if (!refBytes) throw new FaceError("Your photo is missing. Upload it again.", "no_reference");

  const [ref, center, first, second] = await Promise.all([
    readFace(refBytes),
    readFace(frames.center),
    readFace(frames.first),
    readFace(frames.second),
  ]);
  const live: FaceRead[] = [center, first, second];
  debugYaw = live.map((f) => Math.round(f.yaw * 100) / 100);

  if (!ref.embedding) return fail("Your uploaded photo isn't clear enough. Upload a sharper photo.", "ref_unclear");
  if (live.some((f) => f.count === 0 || !f.embedding)) {
    return fail("We lost sight of your face. Keep your whole face in the circle, in good light.", "no_face");
  }
  if (live.some((f) => f.count > 1)) return fail("Only you should be in the camera. Make sure no one else is in view.", "many_faces");
  if (Math.abs(center.yaw) > CENTER_YAW) return fail("Look straight at the camera at the start.", "not_center");
  if (!yawMatches(challenge.order[0], first.yaw) || !yawMatches(challenge.order[1], second.yaw)) {
    return fail("We couldn't confirm the head turns. Turn your head slowly each way when asked.", "turns");
  }
  const real = Math.max(...live.map((f) => f.real));
  const liveness = Math.max(...live.map((f) => f.live));
  if (real < MIN_REAL || liveness < MIN_LIVE) {
    return fail("This looks like a photo or a screen, not a live camera. Use your own face, live.", "spoof");
  }

  const [sCenter, sFirst, sSecond, sSame1, sSame2] = await Promise.all([
    similarity(ref.embedding, center.embedding!),
    similarity(ref.embedding, first.embedding!),
    similarity(ref.embedding, second.embedding!),
    similarity(center.embedding!, first.embedding!),
    similarity(center.embedding!, second.embedding!),
  ]);
  const score = Math.round(sCenter * 1000) / 1000;
  if (sSame1 < TURN_MATCH_THRESHOLD || sSame2 < TURN_MATCH_THRESHOLD) {
    return fail("The face changed during the check. Only you should do the live check.", "swap", score);
  }
  if (sCenter < MATCH_THRESHOLD || Math.max(sFirst, sSecond) < TURN_MATCH_THRESHOLD) {
    return fail(
      "Your live face doesn't match your photo. Upload a recent, clear photo of yourself and try again.",
      "mismatch",
      score
    );
  }

  // Passed. Keep the centre frame privately as the audit record.
  const auditName = `${userId}-live-${crypto.randomUUID()}.jpg`;
  await writeFile(path.join(privateDir(), auditName), frames.center).catch(() => undefined);

  const now = new Date();
  await db.memberVerification.update({
    where: { userId },
    data: { livenessState: "PASSED", livenessVerifiedAt: now, faceScore: score, faceLastError: "" },
  });
  const profile = await db.profile.findUnique({ where: { userId }, select: { verified: true, verifiedSource: true } });
  if (profile && !(profile.verified && profile.verifiedSource === "REVIEWED")) {
    await db.profile.update({
      where: { userId },
      data: { verified: true, verifiedSource: "FACE", verifiedAt: now, verifyNote: `face match ${score}` },
    });
  }
  await import("./welcome").then(({ syncWelcome }) => syncWelcome(userId)).catch((err) => {
    console.error("Welcome reward update failed:", (err as Error).message);
  });
  return { passed: true as const, score };
}

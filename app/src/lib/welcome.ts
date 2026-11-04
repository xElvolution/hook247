import crypto from "crypto";
import type { CheckState, Gender, WelcomeRewardStatus } from "@prisma/client";
import { db } from "./db";
import { confirmPhoneOtp, sendPhoneOtp } from "./dojah";
import { sendWelcomeRewardEmail } from "./mailer";
import { normalizeWhatsApp } from "./whatsapp";

const CAMPAIGN_ID = "default";

export type StepView = {
  key: string;
  label: string;
  state: "passed" | "pending" | "failed";
};

type Person = {
  id: string;
  bannedAt: Date | null;
  suspendedUntil: Date | null;
  profile: {
    displayName: string;
    gender: Gender;
    bio: string;
    city: string;
    birthDate: Date;
    avatarUrl: string;
    photos: string[];
    adminHidden: boolean;
    verified: boolean;
    verifiedSource: string;
  } | null;
  memberVerification: {
    phoneState: CheckState;
    ninState: CheckState;
    livenessState: CheckState;
    phoneHash: string | null;
    ninHash: string | null;
  } | null;
};

function naira(kobo: number) {
  const whole = Math.round(kobo / 100);
  return `₦${whole.toLocaleString("en-NG")}`;
}

function hashId(value: string) {
  const pepper = process.env.AUTH_SECRET || "flirta247";
  return crypto.createHash("sha256").update(`${pepper}:welcome:${value}`).digest("hex");
}

export function normalizeCampaignPhone(input: string) {
  const digits = normalizeWhatsApp(input, "Nigeria");
  if (!digits.startsWith("234") || digits.length < 12 || digits.length > 14) return null;
  return digits;
}

function firstName(name: string) {
  const bit = name.trim().split(/\s+/)[0];
  return bit || "Your referral";
}

function mark(state: CheckState | "passed" | "pending" | "failed"): StepView["state"] {
  if (state === "PASSED" || state === "passed") return "passed";
  if (state === "FAILED" || state === "failed") return "failed";
  return "pending";
}

export function profileReady(person: Person) {
  const p = person.profile;
  if (!p) return false;
  return p.displayName.trim().length >= 2 && p.city.trim().length > 0 && p.bio.trim().length >= 20 && Boolean(p.birthDate);
}

export function photoReady(person: Person) {
  const p = person.profile;
  return Boolean(p && (p.avatarUrl.trim() || p.photos.length > 0));
}

export function accountApproved(person: Person) {
  if (!person.profile || person.bannedAt) return false;
  if (person.suspendedUntil && person.suspendedUntil > new Date()) return false;
  if (person.profile.adminHidden) return false;
  return true;
}

function livenessPassed(person: Person) {
  const v = person.memberVerification;
  if (v?.livenessState === "FAILED") return false;
  if (v?.livenessState === "PASSED") return true;
  // Members who passed the old Dojah selfie check, or the new face check, keep it.
  return person.profile?.verified === true && (person.profile.verifiedSource === "DOJAH" || person.profile.verifiedSource === "FACE");
}

export function stepsFor(person: Person): StepView[] {
  const v = person.memberVerification;
  return [
    { key: "phone", label: "Phone Verification", state: mark(v?.phoneState ?? "PENDING") },
    { key: "liveness", label: "Face Verification", state: livenessPassed(person) ? "passed" : mark(v?.livenessState ?? "PENDING") },
    { key: "profile", label: "Profile Completion", state: profileReady(person) ? "passed" : "pending" },
    { key: "photo", label: "Profile Photo", state: photoReady(person) ? "passed" : "pending" },
    { key: "approval", label: "Account Approval", state: accountApproved(person) ? "passed" : "pending" },
  ];
}

export function fullyVerified(person: Person) {
  return stepsFor(person).every((step) => step.state === "passed") && person.profile?.gender === "FEMALE";
}

export function pendingHint(name: string, steps: StepView[], self = false) {
  const failed = steps.find((step) => step.state === "failed");
  const pending = steps.find((step) => step.state === "pending");
  const step = failed ?? pending;
  if (!step) return "";
  if (self) {
    if (step.key === "phone") return "You have not completed phone verification.";
    if (step.key === "liveness") return "You have not completed facial verification.";
    if (step.key === "profile") return "You need to complete your profile.";
    if (step.key === "photo") return "You need to upload a profile photo.";
    return "Your account is waiting for approval.";
  }
  const who = firstName(name);
  if (step.key === "phone") return `${who} has not completed phone verification.`;
  if (step.key === "liveness") return `${who} has not completed facial verification.`;
  if (step.key === "profile") return `${who} needs to complete her profile.`;
  if (step.key === "photo") return `${who} needs to upload a profile photo.`;
  return `${who}'s account is waiting for approval.`;
}

const personSelect = {
  id: true,
  bannedAt: true,
  suspendedUntil: true,
  referredById: true,
  referralCode: true,
  profile: {
    select: {
      displayName: true,
      gender: true,
      bio: true,
      city: true,
      birthDate: true,
      avatarUrl: true,
      photos: true,
      adminHidden: true,
      verified: true,
      verifiedSource: true,
    },
  },
  memberVerification: {
    select: {
      phoneState: true,
      ninState: true,
      livenessState: true,
      phoneHash: true,
      ninHash: true,
      phoneLast4: true,
    },
  },
} as const;

export async function campaignSettings() {
  return db.welcomeCampaign.upsert({
    where: { id: CAMPAIGN_ID },
    create: { id: CAMPAIGN_ID },
    update: {},
  });
}

async function issuedCount() {
  return db.welcomeReward.count({ where: { status: { not: "VOID" } } });
}

function statusLabel(status: WelcomeRewardStatus, required: number, amountLabel: string) {
  if (status === "LOCKED") return `Locked — Refer ${required} verified members to unlock.`;
  if (status === "UNLOCKED") return `Unlocked — You can now withdraw your ${amountLabel} reward.`;
  if (status === "REQUESTED") return "Withdrawal requested";
  if (status === "WITHDRAWN") return "Withdrawn";
  return "Void";
}

/** Admin override: record a passed face check (e.g. after a manual review). */
export async function recordFacePass(userId: string) {
  const now = new Date();
  await db.memberVerification.upsert({
    where: { userId },
    create: { userId, livenessState: "PASSED", livenessVerifiedAt: now },
    update: { livenessState: "PASSED", livenessVerifiedAt: now, faceLastError: "" },
  });
  await syncWelcome(userId);
}

export async function sendWelcomePhoneCode(userId: string, rawPhone: string) {
  const phone = normalizeCampaignPhone(rawPhone);
  if (!phone) return { ok: false as const, error: "Enter a valid Nigerian phone number." };
  const phoneHash = hashId(phone);
  const taken = await db.memberVerification.findFirst({
    where: { phoneHash, NOT: { userId } },
    select: { userId: true },
  });
  if (taken) return { ok: false as const, error: "This phone number is already verified on another account." };
  const reference = await sendPhoneOtp(phone);
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await db.memberVerification.upsert({
    where: { userId },
    create: { userId, otpReference: reference, otpPhoneHash: phoneHash, otpExpiresAt: expires, otpAttempts: 0 },
    update: { otpReference: reference, otpPhoneHash: phoneHash, otpExpiresAt: expires, otpAttempts: 0 },
  });
  return { ok: true as const };
}

export async function confirmWelcomePhoneCode(userId: string, code: string) {
  const row = await db.memberVerification.findUnique({ where: { userId } });
  if (!row?.otpReference || !row.otpPhoneHash || !row.otpExpiresAt) {
    return { ok: false as const, error: "Request a new code first." };
  }
  if (row.otpExpiresAt < new Date()) return { ok: false as const, error: "That code has expired. Request a new one." };
  if (row.otpAttempts >= 5) return { ok: false as const, error: "Too many attempts. Request a new code." };
  await db.memberVerification.update({ where: { userId }, data: { otpAttempts: { increment: 1 } } });
  const accepted = await confirmPhoneOtp(row.otpReference, code.replace(/\s/g, ""));
  if (!accepted) return { ok: false as const, error: "That code is not correct." };
  const taken = await db.memberVerification.findFirst({
    where: { phoneHash: row.otpPhoneHash, NOT: { userId } },
    select: { userId: true },
  });
  if (taken) return { ok: false as const, error: "This phone number is already verified on another account." };
  await db.memberVerification.update({
    where: { userId },
    data: {
      phoneHash: row.otpPhoneHash,
      phoneLast4: "",
      phoneState: "PASSED",
      phoneVerifiedAt: new Date(),
      otpReference: "",
      otpPhoneHash: "",
      otpExpiresAt: null,
    },
  });
  await syncWelcome(userId);
  return { ok: true as const };
}

async function persistBackfill(person: Person) {
  const source = person.profile?.verifiedSource;
  if (!person.profile || !person.profile.verified || (source !== "DOJAH" && source !== "FACE")) return;
  const v = person.memberVerification;
  if (v?.livenessState === "FAILED" || v?.livenessState === "PASSED") return;
  const now = new Date();
  await db.memberVerification.upsert({
    where: { userId: person.id },
    create: { userId: person.id, livenessState: "PASSED", livenessVerifiedAt: now },
    update: { livenessState: "PASSED", livenessVerifiedAt: now },
  });
}

export async function syncWelcome(userId: string) {
  await refreshReward(userId);
  const user = await db.user.findUnique({ where: { id: userId }, select: { referredById: true } });
  if (user?.referredById) await refreshReward(user.referredById);
}

async function refreshReward(userId: string) {
  const [settings, person] = await Promise.all([
    campaignSettings(),
    db.user.findUnique({ where: { id: userId }, select: personSelect }),
  ]);
  if (!person) return;
  await persistBackfill(person as Person);
  const fresh = (await db.user.findUnique({ where: { id: userId }, select: personSelect })) as Person | null;
  if (!fresh) return;
  const qualifiedSelf = fullyVerified(fresh);
  let reward = await db.welcomeReward.findUnique({ where: { userId } });
  if (!reward && qualifiedSelf && settings.enabled) {
    reward = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT "id" FROM "WelcomeCampaign" WHERE "id" = ${CAMPAIGN_ID} FOR UPDATE`;
      const existing = await tx.welcomeReward.findUnique({ where: { userId } });
      if (existing) return existing;
      const issued = await tx.welcomeReward.count({ where: { status: { not: "VOID" } } });
      const current = await tx.welcomeCampaign.findUnique({ where: { id: CAMPAIGN_ID } });
      if (!current?.enabled || issued >= current.participantLimit) return null;
      return tx.welcomeReward.create({
        data: { userId, amountKobo: current.rewardKobo, slot: issued + 1, status: "LOCKED" },
      });
    });
  }
  if (!reward || reward.status === "VOID" || reward.status === "WITHDRAWN" || reward.status === "REQUESTED") return;
  const qualified = await qualifiedReferralCount(userId, fresh);
  if (reward.status === "LOCKED" && qualified >= settings.requiredReferrals) {
    await db.welcomeReward.update({
      where: { id: reward.id },
      data: { status: "UNLOCKED", unlockedAt: new Date() },
    });
  } else if (reward.status === "UNLOCKED" && qualified < settings.requiredReferrals) {
    await db.welcomeReward.update({
      where: { id: reward.id },
      data: { status: "LOCKED", unlockedAt: null },
    });
  }
}

async function qualifiedReferralCount(referrerId: string, referrer: Person) {
  const rows = await referralPeople(referrerId);
  return rows.filter((row) => row.qualified && !sameIdentity(referrer, row.person)).length;
}

function sameIdentity(a: Person, b: Person) {
  const ap = a.memberVerification?.phoneHash;
  const bp = b.memberVerification?.phoneHash;
  const an = a.memberVerification?.ninHash;
  const bn = b.memberVerification?.ninHash;
  if (ap && bp && ap === bp) return true;
  if (an && bn && an === bn) return true;
  return false;
}

async function referralPeople(referrerId: string) {
  const [people, flags] = await Promise.all([
    db.user.findMany({ where: { referredById: referrerId }, select: personSelect, orderBy: { createdAt: "asc" } }),
    db.welcomeReferralFlag.findMany({ where: { referrerId } }),
  ]);
  const rejected = new Map(flags.map((flag) => [flag.referredId, flag.rejected]));
  return people.map((person) => {
    const cast = person as Person;
    const steps = stepsFor(cast);
    const female = cast.profile?.gender === "FEMALE";
    const rejectedRow = rejected.get(cast.id) === true;
    const qualified = female && !rejectedRow && fullyVerified(cast);
    let overall = "Verification Pending";
    if (rejectedRow) overall = "Rejected";
    else if (!female) overall = "Does not qualify";
    else if (qualified) overall = "Qualified";
    return { person: cast, steps, qualified, overall, rejected: rejectedRow };
  });
}

export async function welcomeDashboard(userId: string) {
  await syncWelcome(userId);
  const [settings, me, reward, issued] = await Promise.all([
    campaignSettings(),
    db.user.findUnique({ where: { id: userId }, select: personSelect }),
    db.welcomeReward.findUnique({ where: { userId } }),
    issuedCount(),
  ]);
  if (!me) return null;
  const person = me as Person;
  const open = settings.enabled && issued < settings.participantLimit;
  const amountLabel = naira(reward?.amountKobo ?? settings.rewardKobo);
  const referrals = await referralPeople(userId);
  const qualified = referrals.filter((row) => row.qualified && !sameIdentity(person, row.person)).length;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://flirta247.com").replace(/\/$/, "");
  const code = me.referralCode ?? "";
  const hasReward = Boolean(reward && reward.status !== "VOID");
  const closed = !hasReward && !open;
  return {
    closed,
    closedMessage: closed ? "Welcome Reward Campaign Closed" : "",
    female: person.profile?.gender === "FEMALE",
    hasProfile: Boolean(person.profile),
    rewardLabel: amountLabel,
    required: settings.requiredReferrals,
    issued,
    limit: settings.participantLimit,
    ownSteps: stepsFor(person),
    ownHint: pendingHint(person.profile?.displayName || "You", stepsFor(person), true),
    reward: reward && reward.status !== "VOID"
      ? {
          status: reward.status,
          statusLabel: statusLabel(reward.status, settings.requiredReferrals, naira(reward.amountKobo)),
          canWithdraw: reward.status === "UNLOCKED",
          amountLabel: naira(reward.amountKobo),
        }
      : null,
    qualified,
    counterLabel: `${Math.min(qualified, settings.requiredReferrals)}/${settings.requiredReferrals}`,
    prompt: `Ask your referral to complete verification to unlock your ${amountLabel} reward.`,
    code,
    link: code ? `${appUrl}/signup?ref=${code}` : "",
    referrals: referrals.map((row) => ({
      id: row.person.id,
      name: row.person.profile?.displayName || "Member",
      steps: row.steps,
      hint: pendingHint(row.person.profile?.displayName || "Your referral", row.steps),
      qualified: row.qualified,
      overall: row.overall,
    })),
  };
}

export async function requestWelcomeWithdrawal(
  userId: string,
  bank: { accountName: string; accountNumber: string; bankName: string }
) {
  const [reward, user] = await Promise.all([
    db.welcomeReward.findUnique({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { payoutsFrozen: true, bannedAt: true } }),
  ]);
  if (user?.bannedAt || user?.payoutsFrozen) {
    return { ok: false as const, error: "Withdrawals are not available on this account." };
  }
  if (!reward || reward.status !== "UNLOCKED") {
    return { ok: false as const, error: "This reward is not unlocked yet." };
  }
  const accountName = bank.accountName.trim().slice(0, 80);
  const accountNumber = bank.accountNumber.replace(/\D/g, "").slice(0, 20);
  const bankName = bank.bankName.trim().slice(0, 80);
  if (accountName.length < 2 || accountNumber.length < 10 || bankName.length < 2) {
    return { ok: false as const, error: "Enter the account name, number and bank." };
  }
  await db.$transaction([
    db.withdrawal.create({
      data: {
        userId,
        amountKobo: reward.amountKobo,
        accountName,
        accountNumber,
        bankName,
        purpose: "welcome",
        status: "REQUESTED",
      },
    }),
    db.welcomeReward.update({
      where: { id: reward.id },
      data: { status: "REQUESTED" },
    }),
  ]);
  return { ok: true as const };
}

export async function settleWelcomeWithdrawal(withdrawalId: string, status: "APPROVED" | "REJECTED" | "PAID") {
  const row = await db.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!row || row.purpose !== "welcome") return;
  if (status === "PAID") {
    await db.welcomeReward.updateMany({
      where: { userId: row.userId, status: "REQUESTED" },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
  }
  if (status === "REJECTED") {
    await db.welcomeReward.updateMany({
      where: { userId: row.userId, status: "REQUESTED" },
      data: { status: "UNLOCKED" },
    });
  }
}

export async function adminCampaignSnapshot() {
  const settings = await campaignSettings();
  const rewards = await db.welcomeReward.findMany({
    orderBy: { slot: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          referralCode: true,
          profile: { select: { displayName: true, gender: true } },
        },
      },
    },
  });
  const rows = [];
  for (const reward of rewards) {
    const people = await referralPeople(reward.userId);
    const qualified = people.filter((row) => row.qualified).length;
    rows.push({
      id: reward.id,
      userId: reward.userId,
      email: reward.user.email,
      name: reward.user.profile?.displayName || "No profile",
      code: reward.user.referralCode,
      status: reward.status,
      amountKobo: reward.amountKobo,
      slot: reward.slot,
      qualified,
      referrals: people.map((row) => ({
        id: row.person.id,
        name: row.person.profile?.displayName || "Member",
        overall: row.overall,
        qualified: row.qualified,
        rejected: row.rejected,
        steps: row.steps.map((step) => `${step.label}: ${step.state}`).join(", "),
      })),
    });
  }
  const active = rewards.filter((row) => row.status !== "VOID");
  const withdrawn = rewards.filter((row) => row.status === "WITHDRAWN");
  return {
    settings,
    issued: active.length,
    issuedKobo: active.reduce((sum, row) => sum + row.amountKobo, 0),
    withdrawnKobo: withdrawn.reduce((sum, row) => sum + row.amountKobo, 0),
    rows,
  };
}

/** Banner plus a one-time email. Men and closed campaigns with no reward stay quiet. */
export async function welcomeNotice(userId: string) {
  const [settings, user, reward, issued] = await Promise.all([
    campaignSettings(),
    db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        bannedAt: true,
        welcomeNotifiedAt: true,
        rewardPillDismissedAt: true,
        profile: { select: { gender: true } },
      },
    }),
    db.welcomeReward.findUnique({ where: { userId } }),
    issuedCount(),
  ]);
  if (!user || user.bannedAt) return { show: false as const };
  if (user.rewardPillDismissedAt) return { show: false as const };
  if (user.profile?.gender === "MALE") return { show: false as const };
  const active = reward && reward.status !== "VOID" && reward.status !== "WITHDRAWN";
  const open = settings.enabled && issued < settings.participantLimit;
  if (!active && !open) return { show: false as const };

  const amountLabel = naira(reward?.amountKobo ?? settings.rewardKobo);
  if (!user.welcomeNotifiedAt) {
    const claimed = await db.user.updateMany({
      where: { id: userId, welcomeNotifiedAt: null },
      data: { welcomeNotifiedAt: new Date() },
    });
    if (claimed.count === 1) {
      try {
        await sendWelcomeRewardEmail(user.email, amountLabel, settings.requiredReferrals);
      } catch (err) {
        console.error("Welcome reward email failed:", (err as Error).message);
        await db.user.update({ where: { id: userId }, data: { welcomeNotifiedAt: null } });
      }
    }
  }

  const short = amountLabel.replace(/,000$/, "k");
  const title = `${short} Reward`;
  let body = "";
  if (reward?.status === "LOCKED") {
    body = `Your ${amountLabel} is locked. Refer ${settings.requiredReferrals} verified women to unlock it.`;
  } else if (reward?.status === "UNLOCKED") {
    body = `Your ${amountLabel} reward is unlocked. You can withdraw it now.`;
  } else if (reward?.status === "REQUESTED") {
    body = `Your ${amountLabel} withdrawal has been requested.`;
  }
  return { show: true as const, title, body, href: "/referrals" };
}

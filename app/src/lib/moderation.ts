import type { Prisma } from "@prisma/client";

/**
 * Shared moderation filters. Every public query composes these rather than
 * writing `bannedAt: null` inline, so a new profile page cannot forget to
 * exclude banned accounts and taken-down posts.
 */

/** Users an admin has not banned. */
export const ACTIVE_USER: Prisma.UserWhereInput = { bannedAt: null };

/** Profiles whose owning account is in good standing and not taken down. */
export const VISIBLE_PROFILE: Prisma.ProfileWhereInput = {
  user: { bannedAt: null },
  adminHidden: false,
};

/** Posts that are neither taken down nor authored by a banned account. */
export const VISIBLE_POST: Prisma.PostWhereInput = {
  hiddenAt: null,
  author: { bannedAt: null },
};

/** Comments hidden individually, or written by a banned account. */
export const VISIBLE_COMMENT: Prisma.CommentWhereInput = {
  hiddenAt: null,
  author: { bannedAt: null },
};

type Moderatable = {
  bannedAt: Date | null;
  banReason?: string;
  suspendedUntil: Date | null;
};

export type AccountStanding =
  | { ok: true; suspendedUntil: null }
  | { ok: false; kind: "banned"; reason: string }
  | { ok: false; kind: "suspended"; until: Date };

/**
 * Whether an account may use the app right now. A ban is permanent until an
 * admin lifts it; a suspension lapses on its own, so it is checked against the
 * clock rather than cleared by a job.
 */
export function standing(user: Moderatable): AccountStanding {
  if (user.bannedAt) {
    return {
      ok: false,
      kind: "banned",
      reason: user.banReason ?? "",
    };
  }
  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    return { ok: false, kind: "suspended", until: user.suspendedUntil };
  }
  return { ok: true, suspendedUntil: null };
}

/** Message shown to a blocked account. Deliberately free of internal detail. */
export function standingMessage(s: AccountStanding): string {
  if (s.ok) return "";
  if (s.kind === "banned") {
    return s.reason
      ? `This account has been closed for breaching our community rules: ${s.reason}`
      : "This account has been closed for breaching our community rules.";
  }
  return `This account is suspended until ${s.until.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}.`;
}

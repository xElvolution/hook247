import { db } from "./db";
import { getSessionUserId } from "./session";
import { standing } from "./moderation";
import { isMockUserId, mockCurrentUser, mockLoginEnabled } from "./mock";

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  if (isMockUserId(userId)) return mockCurrentUser();
  try {
    return await db.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { services: { orderBy: { name: "asc" } } } } },
    });
  } catch (err) {
    if (mockLoginEnabled()) return mockCurrentUser();
    throw err;
  }
}

/**
 * Session id for callers that are about to *write* something — posting,
 * liking, messaging, paying. Returns null for a banned or suspended account so
 * the endpoint answers exactly as it would for a signed-out visitor, rather
 * than letting a moderated user keep acting through the API after the UI has
 * stopped showing them the buttons.
 */
export async function getActiveSessionUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  if (isMockUserId(userId)) return userId;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true, banReason: true, suspendedUntil: true },
    });
    if (!user || !standing(user).ok) return null;
    return userId;
  } catch {
    return mockLoginEnabled() ? userId : null;
  }
}


export function ageFrom(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

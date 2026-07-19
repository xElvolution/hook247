import { db } from "./db";
import { getSessionUserId } from "./session";

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    include: { profile: { include: { services: { orderBy: { name: "asc" } } } } },
  });
}

export function ageFrom(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

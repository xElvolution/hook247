import LiveDirectory from "@/components/LiveDirectory";
import type { LiveHost } from "@/components/LiveStreamViewer";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockSession, mockLiveHosts } from "@/lib/mock";

async function getLiveHosts(): Promise<LiveHost[]> {
  if (await isMockSession()) return mockLiveHosts();
  try {
  const profiles = await db.profile.findMany({
    where: { AND: [VISIBLE_PROFILE, { isLive: true }] },
    include: { services: { where: { enabled: true }, take: 3 } },
    orderBy: { lastActive: "desc" },
    take: 20,
  });
  return profiles.map((profile) => ({
    userId: profile.userId,
    displayName: profile.displayName,
    age: ageFrom(profile.birthDate),
    city: profile.city,
    state: profile.state,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    interests: profile.interests,
    services: profile.services.map((service) => service.name),
    verified: profile.verified,
  }));
  } catch {
    return mockLiveHosts();
  }
}

export default async function LivePage() {
  const [hosts, sessionUserId] = await Promise.all([getLiveHosts(), getSessionUserId()]);
  return <LiveDirectory authed={!!sessionUserId} hosts={hosts} />;
}

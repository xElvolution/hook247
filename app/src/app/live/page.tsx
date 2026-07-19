import LiveDirectory from "@/components/LiveDirectory";
import type { LiveHost } from "@/components/LiveStreamViewer";
import { db } from "@/lib/db";
import { DEMO_PROFILES } from "@/lib/demoProfiles";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";

async function getLiveHosts(): Promise<LiveHost[]> {
  try {
    const profiles = await db.profile.findMany({
      where: { isLive: true },
      include: { services: { where: { enabled: true }, take: 3 } },
      orderBy: { lastActive: "desc" },
      take: 20,
    });
    if (profiles.length) {
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
    }
  } catch {
    // Demo rooms keep Live useful before the production database is connected.
  }

  return DEMO_PROFILES.filter((profile) => profile.live).map((profile) => ({
    userId: profile.userId,
    displayName: profile.displayName,
    age: profile.age,
    city: profile.city,
    state: profile.state,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    interests: profile.interests,
    services: profile.services.slice(0, 3).map((service) => service.name),
    verified: profile.verified,
  }));
}

export default async function LivePage() {
  const [hosts, sessionUserId] = await Promise.all([getLiveHosts(), getSessionUserId()]);
  return <LiveDirectory authed={!!sessionUserId} hosts={hosts} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveStreamViewer, { type LiveHost } from "@/components/LiveStreamViewer";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockUserId, mockLiveHosts } from "@/lib/mock";

async function getLiveHost(userId: string): Promise<LiveHost | null> {
  if (isMockUserId(userId)) {
    return mockLiveHosts().find((h) => h.userId === userId) ?? null;
  }
  const profile = await db.profile.findFirst({
    where: { AND: [VISIBLE_PROFILE, { userId }] },
    include: { services: { where: { enabled: true }, take: 3 } },
  });
  if (!profile?.isLive) return null;

  return {
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
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const host = await getLiveHost(userId);
  if (!host) return { title: "Live room ended | Hook247" };
  return {
    title: `${host.displayName} is live | Hook247`,
    description: `Watch ${host.displayName}'s live room on Hook247.`,
  };
}

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const host = await getLiveHost(userId);
  if (!host) notFound();

  const sessionUserId = await getSessionUserId();
  const initialViewers = 180 + host.displayName.charCodeAt(0) * 7 + host.age * 3;

  return <LiveStreamViewer authed={!!sessionUserId} host={host} initialViewers={initialViewers} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Radio } from "lucide-react";
import LiveStreamViewer from "@/components/LiveStreamViewer";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import { liveForHost } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const live = await liveForHost(userId, null).catch(() => null);
  if (!live) return { title: "Live room | Hooks247" };
  return {
    title: `${live.host.displayName} is live | Hooks247`,
    description: `Watch ${live.host.displayName}'s live room on Hooks247.`,
  };
}

export default async function LiveRoomPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const sessionUserId = await getSessionUserId();
  const live = await liveForHost(userId, sessionUserId);

  if (!live) {
    const profile = await db.profile.findFirst({
      where: { AND: [VISIBLE_PROFILE, { userId }] },
      select: { displayName: true, avatarUrl: true },
    });
    if (!profile) notFound();
    return (
      <main className="stream-room">
        <div className="stream-background" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : null}
        </div>
        <section className="live-summary">
          <Radio className="h-7 w-7 text-[#ef789a]" />
          <h1>{profile.displayName} is not live right now</h1>
          <p className="text-sm text-muted">Check back later, or see who else is streaming.</p>
          <div className="live-stage-actions">
            <Link href="/live" className="btn-primary text-sm">See who is live</Link>
            <Link href={`/profiles/${encodeURIComponent(userId)}`} className="live-ghost-button">View profile</Link>
          </div>
        </section>
      </main>
    );
  }

  return <LiveStreamViewer authed={!!sessionUserId && !sessionUserId.startsWith("mock")} host={live.host} session={live.session} />;
}

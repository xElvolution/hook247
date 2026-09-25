import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import GoLiveStudio from "@/components/live/GoLiveStudio";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";
import { getActiveSessionForHost, liveConfigured } from "@/lib/live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Go live | Hooks247" };

function Notice({ title, body, avatarUrl }: { title: string; body: string; avatarUrl?: string }) {
  return (
    <main className="stream-room">
      {avatarUrl ? (
        <div className="stream-background" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl ? <img src={avatarUrl} alt="" /> : null}
        </div>
      ) : null}
      <section className="live-summary">
        <Radio className="h-7 w-7 text-[#ef789a]" />
        <h1>{title}</h1>
        <p className="text-sm text-muted">{body}</p>
        <div className="live-stage-actions">
          <Link href="/live" className="btn-primary text-sm">Watch lives</Link>
          <Link href="/feed" className="live-ghost-button">Back to feed</Link>
        </div>
      </section>
    </main>
  );
}

export default async function GoLivePage() {
  const userId = await getActiveSessionUserId();
  if (!userId) redirect("/login?next=/live/go");
  if (userId.startsWith("mock")) return <Notice title="Create an account to go live" body="Live streaming needs a real escort account." />;

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { role: true, displayName: true, avatarUrl: true, adminHidden: true },
  });
  if (!profile) redirect("/onboarding");
  if (profile.role !== "ESCORT") {
    return <Notice title="Going live is for escorts" body="Only escort accounts can host a live. You can still watch, comment and send gifts." avatarUrl={profile.avatarUrl} />;
  }
  if (profile.adminHidden) {
    return <Notice title="Your profile is under review" body="You can go live again once the review is finished." avatarUrl={profile.avatarUrl} />;
  }
  if (!liveConfigured()) {
    return <Notice title="Live is temporarily unavailable" body="Streaming is being set up. Please try again shortly." avatarUrl={profile.avatarUrl} />;
  }

  const active = await getActiveSessionForHost(userId);
  return (
    <GoLiveStudio
      hostId={userId}
      displayName={profile.displayName}
      avatarUrl={profile.avatarUrl}
      resume={active ? { id: active.id, title: active.title, startedAt: active.startedAt.toISOString() } : null}
    />
  );
}

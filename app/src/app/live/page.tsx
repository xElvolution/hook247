import LiveDirectory from "@/components/LiveDirectory";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { listLives, liveConfigured } from "@/lib/live";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const sessionUserId = await getSessionUserId();
  const [lives, me] = await Promise.all([
    liveConfigured() ? listLives().catch(() => []) : Promise.resolve([]),
    sessionUserId && !sessionUserId.startsWith("mock")
      ? db.profile.findUnique({ where: { userId: sessionUserId }, select: { role: true } }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return <LiveDirectory authed={!!sessionUserId} canGoLive={me?.role === "ESCORT"} lives={lives} />;
}

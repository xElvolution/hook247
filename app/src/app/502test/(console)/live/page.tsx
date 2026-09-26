import Link from "next/link";
import { db } from "@/lib/db";
import { reconcileLives } from "@/lib/live";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { forceEndLive } from "./actions";

export const dynamic = "force-dynamic";


function duration(from: Date, to: Date | null) {
  const mins = Math.max(0, Math.round(((to ?? new Date()).getTime() - from.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default async function LiveAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const params = await searchParams;
  await reconcileLives(true).catch(() => undefined);
  const [sessions] = await Promise.all([
    db.liveSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 40,
      include: { host: { select: { email: true, profile: { select: { displayName: true } } } }, _count: { select: { comments: true } } },
    }),
  ]);
  const ids = sessions.map((s) => s.id);
  // Gifts from before the earnings wallet were plain coin tips; count both.
  const [legacy, gifted] = ids.length
    ? await Promise.all([
        db.coinTransaction.groupBy({ by: ["liveSessionId"], where: { liveSessionId: { in: ids }, type: "TIP_RECEIVED" }, _sum: { amount: true } }),
        db.ledgerEntry.groupBy({ by: ["liveSessionId"], where: { liveSessionId: { in: ids }, kind: "GIFT" }, _sum: { coins: true } }),
      ])
    : [[], []];
  const earnedBy = new Map<string | null, number>();
  for (const e of legacy) earnedBy.set(e.liveSessionId, (earnedBy.get(e.liveSessionId) ?? 0) + (e._sum.amount ?? 0));
  for (const e of gifted) earnedBy.set(e.liveSessionId, (earnedBy.get(e.liveSessionId) ?? 0) + (e._sum.coins ?? 0));
  const active = sessions.filter((s) => s.status === "LIVE");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Live</h1>
        <p className="mt-1 text-sm text-muted">{active.length} live now · media served by the self-hosted LiveKit server</p>
      </div>
      {params.error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{params.error}</p> : null}
      {params.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{params.ok}</p> : null}

      <Panel title="Sessions">
        {sessions.length === 0 ? (
          <Empty>No lives yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="py-2">Host</th><th>Title</th><th>Status</th><th>Started</th><th>Length</th><th>Peak</th><th>Comments</th><th>Coins</th><th /></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-line/60">
                    <td className="py-2">
                      <Link href={`/502test/users/${s.hostId}`} className="underline">{s.host.profile?.displayName ?? s.host.email}</Link>
                    </td>
                    <td className="max-w-[14rem] truncate">{s.title}</td>
                    <td>{s.status === "LIVE" ? <Badge tone="brand">Live</Badge> : <span className="text-xs text-muted">{s.endReason || "ended"}</span>}</td>
                    <td className="text-xs text-muted">{s.startedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                    <td>{duration(s.startedAt, s.endedAt)}</td>
                    <td>{s.peakViewers}</td>
                    <td>{s._count.comments}</td>
                    <td>{(earnedBy.get(s.id) ?? 0).toLocaleString("en-NG")}</td>
                    <td>
                      {s.status === "LIVE" ? (
                        <form action={forceEndLive}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="rounded border border-red-500/50 px-2 py-1 text-xs font-semibold text-red-300">End</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-sm text-muted">
        The gift catalog now lives on its own page: <Link href="/502test/gifts" className="underline">Gifts</Link>.
      </p>
    </div>
  );
}

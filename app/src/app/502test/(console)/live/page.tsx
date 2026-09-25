import Link from "next/link";
import { db } from "@/lib/db";
import { ensureGifts, reconcileLives } from "@/lib/live";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { forceEndLive, saveGift } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand";

function duration(from: Date, to: Date | null) {
  const mins = Math.max(0, Math.round(((to ?? new Date()).getTime() - from.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default async function LiveAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const params = await searchParams;
  await ensureGifts();
  await reconcileLives(true).catch(() => undefined);
  const [gifts, sessions] = await Promise.all([
    db.liveGift.findMany({ orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }),
    db.liveSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 40,
      include: { host: { select: { email: true, profile: { select: { displayName: true } } } }, _count: { select: { comments: true } } },
    }),
  ]);
  const earned = sessions.length
    ? await db.coinTransaction.groupBy({
        by: ["liveSessionId"],
        where: { liveSessionId: { in: sessions.map((s) => s.id) }, type: "TIP_RECEIVED" },
        _sum: { amount: true },
      })
    : [];
  const earnedBy = new Map(earned.map((e) => [e.liveSessionId, e._sum.amount ?? 0]));
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

      <Panel title="Gifts">
        <div className="space-y-2">
          {gifts.map((gift) => (
            <form key={gift.id} action={saveGift} className="flex flex-wrap items-end gap-2 rounded-lg border border-line/70 p-2">
              <input type="hidden" name="id" value={gift.id} />
              <label className="text-xs text-muted">Emoji<input name="emoji" defaultValue={gift.emoji} className={`${input} mt-1 block w-16`} /></label>
              <label className="text-xs text-muted">Name<input name="name" defaultValue={gift.name} className={`${input} mt-1 block w-32`} /></label>
              <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} defaultValue={gift.coins} className={`${input} mt-1 block w-24`} /></label>
              <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={gift.sortOrder} className={`${input} mt-1 block w-16`} /></label>
              <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={gift.active} /> Active</label>
              <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Save</button>
            </form>
          ))}
          <form action={saveGift} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-2">
            <label className="text-xs text-muted">Emoji<input name="emoji" placeholder="🎁" className={`${input} mt-1 block w-16`} /></label>
            <label className="text-xs text-muted">Name<input name="name" placeholder="New gift" className={`${input} mt-1 block w-32`} /></label>
            <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} className={`${input} mt-1 block w-24`} /></label>
            <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={gifts.length + 1} className={`${input} mt-1 block w-16`} /></label>
            <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Add gift</button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { coinPrice, getCoinSettings } from "@/lib/coins";
import { ensureGifts, GIFT_ANIMATIONS } from "@/lib/live";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { deleteGift, restoreGift, saveGift } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand";

function AnimationSelect({ value }: { value: string }) {
  return (
    <select name="animation" defaultValue={value} className={`${input} mt-1 block w-28`}>
      {GIFT_ANIMATIONS.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}

export default async function GiftsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const params = await searchParams;
  await ensureGifts();
  const [gifts, settings, sent] = await Promise.all([
    db.liveGift.findMany({ orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }),
    getCoinSettings(),
    db.ledgerEntry.groupBy({ by: ["giftId"], where: { kind: "GIFT", giftId: { not: null } }, _count: true, _sum: { coins: true } }),
  ]);
  const price = coinPrice(settings);
  const sentBy = new Map(sent.map((s) => [s.giftId, s]));
  const live = gifts.filter((g) => !g.deletedAt);
  const archived = gifts.filter((g) => g.deletedAt);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Gifts</h1>
        <p className="mt-1 text-sm text-muted">
          What viewers can send during lives. Each coin is worth {nairaFromKobo(price)}; the escort receives {settings.escortSharePct}% of the value.
        </p>
      </div>
      {params.error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{params.error}</p> : null}
      {params.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{params.ok}</p> : null}

      <Panel title="Catalog">
        <div className="space-y-2">
          {live.map((gift) => {
            const stats = sentBy.get(gift.id);
            return (
              <div key={gift.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-line/70 p-2">
                <form action={saveGift} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={gift.id} />
                  <label className="text-xs text-muted">Emoji<input name="emoji" defaultValue={gift.emoji} className={`${input} mt-1 block w-16`} /></label>
                  <label className="text-xs text-muted">Name<input name="name" defaultValue={gift.name} className={`${input} mt-1 block w-32`} /></label>
                  <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} defaultValue={gift.coins} className={`${input} mt-1 block w-24`} /></label>
                  <label className="text-xs text-muted">Animation<AnimationSelect value={gift.animation} /></label>
                  <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={gift.sortOrder} className={`${input} mt-1 block w-16`} /></label>
                  <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={gift.active} /> Active</label>
                  <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Save</button>
                </form>
                <span className="pb-2 text-xs text-muted">
                  {nairaFromKobo(gift.coins * price)} · escort gets {nairaFromKobo(Math.floor((gift.coins * price * settings.escortSharePct) / 100))}
                  {stats ? ` · sent ${stats._count.toLocaleString("en-NG")} times` : ""}
                </span>
                {!gift.active ? <span className="pb-2"><Badge>disabled</Badge></span> : null}
                <form action={deleteGift} className="ml-auto">
                  <input type="hidden" name="id" value={gift.id} />
                  <button type="submit" className="rounded border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold text-red-300">Delete</button>
                </form>
              </div>
            );
          })}
          <form action={saveGift} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-2">
            <label className="text-xs text-muted">Emoji<input name="emoji" placeholder="🎁" className={`${input} mt-1 block w-16`} /></label>
            <label className="text-xs text-muted">Name<input name="name" placeholder="New gift" className={`${input} mt-1 block w-32`} /></label>
            <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} className={`${input} mt-1 block w-24`} /></label>
            <label className="text-xs text-muted">Animation<AnimationSelect value="float" /></label>
            <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={live.length + 1} className={`${input} mt-1 block w-16`} /></label>
            <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Add gift</button>
          </form>
        </div>
        <p className="mt-3 text-xs text-muted">
          Animations: float and pulse drift up the screen, burst fills the centre, spotlight takes over the stage, royal adds a gold ring and a caption with the sender&apos;s name.
          Deleting a gift that was already sent archives it so its history stays intact.
        </p>
      </Panel>

      <Panel title="Archived">
        {archived.length ? (
          <ul className="space-y-1.5 text-sm">
            {archived.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <span>{g.emoji} {g.name}</span>
                <span className="text-xs text-muted">{g.coins.toLocaleString("en-NG")} coins · archived {g.deletedAt?.toLocaleDateString("en-NG")}</span>
                <form action={restoreGift}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="rounded border border-line px-2 py-0.5 text-[11px]">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No archived gifts.</Empty>
        )}
      </Panel>
    </div>
  );
}

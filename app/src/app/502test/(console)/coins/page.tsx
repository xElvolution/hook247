import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { coinPrice, ensureCoinCatalog, getCoinSettings } from "@/lib/coins";
import { legacyConversionPreview } from "@/lib/earnings";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { adjustWallet, convertLegacyCoins, deletePack, recheckPurchase, saveCoinSettings, savePack } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand";

function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>;
  if (ok) return <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{ok}</p>;
  return null;
}

export default async function CoinsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; user?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await ensureCoinCatalog();
  const [settings, packs, totals, purchases, legacy, earningsTotals] = await Promise.all([
    getCoinSettings(),
    db.coinPack.findMany({ orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }),
    db.coinWallet.aggregate({ _sum: { balance: true, held: true } }),
    db.coinPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } } },
    }),
    legacyConversionPreview(),
    db.earningsWallet.aggregate({ _sum: { balanceKobo: true, heldKobo: true } }),
  ]);
  const price = coinPrice(settings);
  const legacyTotalCoins = legacy.rows.reduce((sum, r) => sum + r.coins, 0);
  const legacyTotalKobo = legacy.rows.reduce((sum, r) => sum + r.nairaKobo, 0);

  const q = (params.q ?? "").trim();
  const matches = q
    ? await db.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { profile: { displayName: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: { id: true, email: true, profile: { select: { displayName: true, role: true } } },
        take: 10,
      })
    : [];

  const selected = params.user
    ? await db.user.findUnique({
        where: { id: params.user },
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true, role: true } },
          coinWallet: true,
          coinTransactions: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Coins</h1>
        <p className="mt-1 text-sm text-muted">
          {(totals._sum.balance ?? 0).toLocaleString("en-NG")} coins in wallets ·{" "}
          {nairaFromKobo(earningsTotals._sum.balanceKobo ?? 0)} in escort earnings ({nairaFromKobo(earningsTotals._sum.heldKobo ?? 0)} held) ·{" "}
          <Link href="/502test/transactions" className="underline">Transactions</Link> ·{" "}
          <Link href="/502test/coin-payouts" className="underline">Payout queue</Link>
        </p>
      </div>
      <Flash ok={params.ok} error={params.error} />

      <Panel title="Settings">
        <form action={saveCoinSettings} className="grid gap-3 sm:grid-cols-4">
          <div className="text-xs text-muted">
            Coin price
            <p className="mt-1 rounded border border-line bg-bg px-2 py-1.5 text-sm text-ink">{nairaFromKobo(price)} per coin (fixed)</p>
          </div>
          <label className="text-xs text-muted">
            Escort share (%)
            <input name="escortSharePct" type="number" min={1} max={100} defaultValue={settings.escortSharePct} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-xs text-muted">
            Withdrawal fee (%)
            <input name="feePct" inputMode="decimal" defaultValue={settings.withdrawalFeeBps / 100} className={`${input} mt-1 w-full`} />
          </label>
          <div className="flex flex-col justify-end gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="manualWithdrawalApproval" defaultChecked={settings.manualWithdrawalApproval} />
              Manual withdrawal approval
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="paystackTransfersEnabled" defaultChecked={settings.paystackTransfersEnabled} />
              Paystack transfers enabled
            </label>
          </div>
          <p className="text-xs text-muted sm:col-span-4">
            Every gift is split {settings.escortSharePct}% to the escort and {100 - settings.escortSharePct}% to the platform. The escort share goes straight into their Earnings Wallet.
            Changes apply to new gifts and withdrawals only. Only tick Paystack transfers once Transfers are switched on for the Paystack business account (and OTP for transfers is disabled).
            Until then pay escorts by bank transfer and mark requests paid with the reference.
          </p>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary !py-2 text-sm">Save settings</button>
          </div>
        </form>
      </Panel>

      <Panel title="Coin packs">
        <p className="mb-3 text-xs text-muted">Prices are always coins × {nairaFromKobo(price)}, with no discounts. Hidden packs are not offered to buyers.</p>
        <div className="space-y-2">
          {packs.map((pack) => (
            <div key={pack.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-line/70 p-2">
              <form action={savePack} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={pack.id} />
                <label className="text-xs text-muted">Name<input name="name" defaultValue={pack.name} className={`${input} mt-1 block w-32`} /></label>
                <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} defaultValue={pack.coins} className={`${input} mt-1 block w-24`} /></label>
                <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={pack.sortOrder} className={`${input} mt-1 block w-16`} /></label>
                <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={pack.active} /> Active</label>
                <span className="pb-2 text-xs text-muted">Price {nairaFromKobo(pack.coins * price)}</span>
                <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Save</button>
              </form>
              <form action={deletePack}>
                <input type="hidden" name="id" value={pack.id} />
                <button type="submit" className="rounded border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold text-red-300">Delete</button>
              </form>
            </div>
          ))}
          <form action={savePack} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-2">
            <label className="text-xs text-muted">Name<input name="name" placeholder="New pack" className={`${input} mt-1 block w-32`} /></label>
            <label className="text-xs text-muted">Coins<input name="coins" type="number" min={1} className={`${input} mt-1 block w-24`} /></label>
            <label className="text-xs text-muted">Order<input name="sortOrder" type="number" defaultValue={packs.length + 1} className={`${input} mt-1 block w-16`} /></label>
            <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Add pack</button>
          </form>
        </div>
      </Panel>

      <Panel title="Legacy escort coins">
        {legacy.convertedAt ? (
          <p className="mb-3 text-xs text-muted">Last conversion ran {legacy.convertedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.</p>
        ) : null}
        {legacy.rows.length ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Escorts still hold coins from before earnings moved to naira. Converting moves each balance into their Earnings Wallet at the old payout rate of{" "}
              {nairaFromKobo(legacy.rateKobo)} per coin: {legacyTotalCoins.toLocaleString("en-NG")} coins, {nairaFromKobo(legacyTotalKobo)} in total. Client coins are never touched.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-muted">
                  <tr><th className="py-1.5">Escort</th><th>Coins</th><th>Held</th><th>Lifetime tips</th><th>Converts to</th></tr>
                </thead>
                <tbody>
                  {legacy.rows.map((r) => (
                    <tr key={r.userId} className="border-t border-line">
                      <td className="py-1.5"><Link href={`/502test/coins?user=${r.userId}`} className="underline">{r.name}</Link> <span className="text-muted">{r.email}</span></td>
                      <td>{r.coins.toLocaleString("en-NG")}</td>
                      <td>{r.held.toLocaleString("en-NG")}</td>
                      <td>{r.lifetimeEarned.toLocaleString("en-NG")}</td>
                      <td>{nairaFromKobo(r.nairaKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={convertLegacyCoins} className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted">Type CONVERT to confirm<input name="confirm" autoComplete="off" className={`${input} mt-1 block w-40`} /></label>
              <button type="submit" className="rounded border border-amber-400/50 px-2.5 py-1.5 text-xs font-semibold text-amber-300">Convert to earnings</button>
            </form>
          </>
        ) : (
          <Empty>No escort holds legacy coins.</Empty>
        )}
      </Panel>

      <Panel title="Wallet ledger">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search email or display name" className={`${input} w-64`} />
          <button type="submit" className="rounded border border-line px-3 py-1.5 text-xs font-semibold">Search</button>
        </form>
        {q && !matches.length ? <p className="mt-3 text-sm text-muted">No members match.</p> : null}
        {matches.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/502test/coins?user=${m.id}`} className="underline">
                  {m.profile?.displayName ?? m.email}
                </Link>{" "}
                <span className="text-muted">{m.email}</span> {m.profile?.role === "ESCORT" ? <Badge>escort</Badge> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              <strong>{selected.profile?.displayName ?? selected.email}</strong> <span className="text-muted">{selected.email}</span>
              <br />
              Balance <strong>{(selected.coinWallet?.balance ?? 0).toLocaleString("en-NG")}</strong> · held{" "}
              {(selected.coinWallet?.held ?? 0).toLocaleString("en-NG")} · lifetime tips{" "}
              {(selected.coinWallet?.lifetimeEarned ?? 0).toLocaleString("en-NG")}
            </p>
            <form action={adjustWallet} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={selected.id} />
              <input type="hidden" name="nonce" value={randomUUID()} />
              <label className="text-xs text-muted">Coins (+/-)<input name="delta" type="number" className={`${input} mt-1 block w-28`} /></label>
              <label className="text-xs text-muted">Note<input name="note" placeholder="Reason for the adjustment" className={`${input} mt-1 block w-64`} /></label>
              <button type="submit" className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold">Adjust</button>
            </form>
            {selected.coinTransactions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="uppercase text-muted">
                    <tr><th className="py-1.5">When</th><th>Type</th><th>Change</th><th>Balance</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {selected.coinTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-line">
                        <td className="py-1.5">{t.createdAt.toLocaleString("en-NG")}</td>
                        <td>{t.type}</td>
                        <td className={t.amount > 0 ? "text-good" : t.amount < 0 ? "text-red-300" : ""}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                        <td>{t.balanceAfter}</td>
                        <td className="text-muted">{[t.source, t.note].filter(Boolean).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No coin activity for this member.</Empty>
            )}
          </div>
        ) : null}
      </Panel>

      <Panel title="Recent purchases">
        {purchases.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted">
                <tr><th className="py-1.5">When</th><th>Member</th><th>Coins</th><th>Paid</th><th>Status</th><th>Reference</th><th></th></tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-1.5">{p.createdAt.toLocaleString("en-NG")}</td>
                    <td><Link href={`/502test/coins?user=${p.userId}`} className="underline">{p.user.email}</Link></td>
                    <td>{p.coins}</td>
                    <td>{nairaFromKobo(p.amountKobo)}</td>
                    <td><Badge tone={p.status === "SUCCESS" ? "good" : p.status === "PENDING" ? "warn" : "muted"}>{p.status}</Badge></td>
                    <td className="text-muted">{p.reference}</td>
                    <td>
                      {p.status !== "SUCCESS" ? (
                        <form action={recheckPurchase}>
                          <input type="hidden" name="reference" value={p.reference} />
                          <button type="submit" className="rounded border border-line px-2 py-0.5 text-[11px]">Re-check</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No coin purchases yet.</Empty>
        )}
      </Panel>
    </div>
  );
}

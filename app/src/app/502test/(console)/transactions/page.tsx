import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { Panel, Badge, Empty, Stat } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

const input = "rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand";
const KINDS = ["GIFT", "PURCHASE", "WITHDRAWAL_REQUEST", "WITHDRAWAL_APPROVED", "WITHDRAWAL_PAID", "WITHDRAWAL_REJECTED", "LEGACY_CONVERSION", "ADMIN_ADJUST"] as const;
const STATUSES = ["COMPLETED", "PENDING", "FAILED", "REVERSED"] as const;
const PAGE = 100;

type Search = { kind?: string; status?: string; user?: string; q?: string; from?: string; to?: string; page?: string };

function lagos(d: Date) {
  return d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Start of a Lagos calendar day (UTC+1) from a yyyy-mm-dd input. */
function lagosDay(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00+01:00`);
  if (endOfDay) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const kind = (KINDS as readonly string[]).includes(params.kind ?? "") ? (params.kind as (typeof KINDS)[number]) : params.kind === "all" ? undefined : "GIFT";
  const status = (STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as (typeof STATUSES)[number]) : undefined;
  const page = Math.max(1, Math.floor(Number(params.page ?? 1)) || 1);
  const q = (params.q ?? "").trim();

  let userIds: string[] | undefined;
  if (params.user) userIds = [params.user];
  else if (q) {
    const users = await db.user.findMany({
      where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { profile: { displayName: { contains: q, mode: "insensitive" } } }] },
      select: { id: true },
      take: 50,
    });
    userIds = users.map((u) => u.id);
  }

  const from = lagosDay(params.from);
  const to = lagosDay(params.to, true);
  const where: Prisma.LedgerEntryWhereInput = {
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(userIds ? { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }] } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };

  const [rows, count, totals] = await Promise.all([
    db.ledgerEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.ledgerEntry.count({ where }),
    db.ledgerEntry.aggregate({
      where,
      _sum: { coins: true, amountKobo: true, escortShareKobo: true, platformShareKobo: true, feeKobo: true, payoutKobo: true },
    }),
  ]);

  const ids = [...new Set(rows.flatMap((r) => [r.senderId, r.receiverId]).filter((id): id is string => !!id))];
  const people = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, profile: { select: { displayName: true } } } })
    : [];
  const who = new Map(people.map((p) => [p.id, p.profile?.displayName ?? p.email]));

  const qs = (overrides: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, String(v));
    return `/502test/transactions?${next.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(count / PAGE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        <p className="mt-1 text-sm text-muted">
          Every coin and earnings movement, written once and never edited. Each entry has a unique key, so a repeated request cannot be counted twice.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Entries" value={count.toLocaleString("en-NG")} />
        <Stat label="Coins" value={(totals._sum.coins ?? 0).toLocaleString("en-NG")} sub={nairaFromKobo(totals._sum.amountKobo ?? 0)} />
        <Stat label="Escort share" value={nairaFromKobo(totals._sum.escortShareKobo ?? 0)} tone="good" />
        <Stat
          label="Platform share"
          value={nairaFromKobo(totals._sum.platformShareKobo ?? 0)}
          sub={totals._sum.feeKobo ? `plus ${nairaFromKobo(totals._sum.feeKobo)} in fees` : undefined}
          tone="brand"
        />
      </div>

      <Panel title="Filter">
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Type
            <select name="kind" defaultValue={params.kind ?? "GIFT"} className={`${input} mt-1 block`}>
              <option value="all">All</option>
              {KINDS.map((k) => <option key={k} value={k}>{k.replaceAll("_", " ").toLowerCase()}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">
            Status
            <select name="status" defaultValue={params.status ?? ""} className={`${input} mt-1 block`}>
              <option value="">Any</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Member<input name="q" defaultValue={q} placeholder="Email or name" className={`${input} mt-1 block w-48`} /></label>
          <label className="text-xs text-muted">From<input type="date" name="from" defaultValue={params.from ?? ""} className={`${input} mt-1 block`} /></label>
          <label className="text-xs text-muted">To<input type="date" name="to" defaultValue={params.to ?? ""} className={`${input} mt-1 block`} /></label>
          <button type="submit" className="rounded border border-line px-3 py-1.5 text-xs font-semibold">Apply</button>
          <Link href="/502test/transactions" className="pb-1.5 text-xs text-muted underline">Reset</Link>
        </form>
        {params.user ? <p className="mt-2 text-xs text-muted">Showing one member only. <Link href={qs({ user: "" })} className="underline">Show everyone</Link></p> : null}
      </Panel>

      <Panel title={`Entries (page ${page} of ${pages})`}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-xs">
              <thead className="uppercase text-muted">
                <tr>
                  <th className="py-1.5">ID</th><th>Type</th><th>Sender</th><th>Receiver</th><th>Gift</th><th>Coins</th><th>Value</th>
                  <th>Escort share</th><th>Platform share</th><th>Fee</th><th>Date and time (WAT)</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-1.5 font-mono text-[10px] text-muted" title={r.idempotencyKey}>{r.id.slice(-10)}</td>
                    <td>{r.kind.replaceAll("_", " ").toLowerCase()}{r.source ? <span className="text-muted"> · {r.source}</span> : null}</td>
                    <td>{r.senderId ? <Link href={qs({ user: r.senderId, q: "", page: "" })} className="underline">{who.get(r.senderId) ?? "Member"}</Link> : "-"}</td>
                    <td>{r.receiverId ? <Link href={qs({ user: r.receiverId, q: "", page: "" })} className="underline">{who.get(r.receiverId) ?? "Member"}</Link> : "-"}</td>
                    <td>{r.giftName ? `${r.giftEmoji} ${r.giftName}` : "-"}</td>
                    <td>{r.coins ? r.coins.toLocaleString("en-NG") : "-"}</td>
                    <td>{r.amountKobo ? nairaFromKobo(r.amountKobo) : "-"}</td>
                    <td>{r.escortShareKobo ? `${nairaFromKobo(r.escortShareKobo)}${r.escortSharePct ? ` (${r.escortSharePct}%)` : ""}` : "-"}</td>
                    <td>{r.platformShareKobo ? `${nairaFromKobo(r.platformShareKobo)}${r.escortSharePct ? ` (${100 - r.escortSharePct}%)` : ""}` : "-"}</td>
                    <td>{r.feeKobo ? nairaFromKobo(r.feeKobo) : "-"}</td>
                    <td className="whitespace-nowrap">{lagos(r.createdAt)}</td>
                    <td>
                      <Badge tone={r.status === "COMPLETED" ? "good" : r.status === "PENDING" ? "warn" : r.status === "FAILED" ? "bad" : "muted"}>
                        {r.status.toLowerCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No transactions match.</Empty>
        )}
        {pages > 1 ? (
          <div className="mt-3 flex gap-2 text-xs">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded border border-line px-2 py-1">Newer</Link> : null}
            {page < pages ? <Link href={qs({ page: String(page + 1) })} className="rounded border border-line px-2 py-1">Older</Link> : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

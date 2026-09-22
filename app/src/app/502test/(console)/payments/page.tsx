import Link from "next/link";
import { Prisma, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { naira } from "@/lib/adminStats";
import { Panel, Badge, Empty, Stat } from "@/components/admin/Ui";
import { retryPayment } from "../actions";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "all";
  const q = (params.q ?? "").trim();

  const where: Prisma.PaymentWhereInput = {};
  if (status !== "all") where.status = status as PaymentStatus;
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [payments, totals] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        user: {
          select: { email: true, profile: { select: { displayName: true, plan: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.payment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountKobo: true },
    }),
  ]);

  const byStatus = new Map(totals.map((t) => [t.status, t]));
  const succeeded = byStatus.get(PaymentStatus.SUCCESS);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted">
          Newest 100. Retry is safe to press twice. Fulfilment claims each row
          atomically, so a benefit is granted exactly once.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Collected"
          value={naira(succeeded?._sum.amountKobo ?? 0)}
          sub={`${succeeded?._count._all ?? 0} successful`}
          tone="brand"
        />
        {[PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.ABANDONED].map(
          (s) => (
            <Stat
              key={s}
              label={s.toLowerCase()}
              value={byStatus.get(s)?._count._all ?? 0}
              tone={
                s === PaymentStatus.PENDING &&
                (byStatus.get(s)?._count._all ?? 0) > 0
                  ? "warn"
                  : "default"
              }
            />
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["all", ...Object.values(PaymentStatus)].map((s) => (
          <Link
            key={s}
            href={`/502test/payments?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              status === s
                ? "bg-brand text-white"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {s.toLowerCase()}
          </Link>
        ))}

        <form className="ml-auto flex gap-2" action="/502test/payments">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Reference or email"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand/50">
            Search
          </button>
        </form>
      </div>

      <Panel title="Transactions">
        {payments.length === 0 ? (
          <Empty>No payments match that filter.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-3">Reference</th>
                  <th className="pb-2 pr-3">User</th>
                  <th className="pb-2 pr-3">Purpose</th>
                  <th className="pb-2 pr-3">Amount</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Created</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/50">
                    <td className="py-2 pr-3 font-mono text-xs">{p.reference}</td>
                    <td className="py-2 pr-3">
                      {p.user.profile?.displayName ?? p.user.email}
                      <span className="block text-xs text-muted">
                        {p.user.email}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{p.purpose}</td>
                    <td className="py-2 pr-3 font-semibold">
                      {naira(p.amountKobo)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        tone={
                          p.status === "SUCCESS"
                            ? "good"
                            : p.status === "PENDING"
                              ? "warn"
                              : "bad"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">
                      {p.createdAt.toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2">
                      {p.status !== "SUCCESS" ? (
                        <form action={retryPayment}>
                          <input
                            type="hidden"
                            name="reference"
                            value={p.reference}
                          />
                          <button className="rounded border border-line px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-ink">
                            Retry
                          </button>
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
    </div>
  );
}

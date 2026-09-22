import Link from "next/link";
import { getOverview, naira } from "@/lib/adminStats";
import { Stat, Panel, Bars, Empty } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const s = await getOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Admin overview</h1>
        <p className="mt-1 text-sm text-muted">
          Control profiles, plans, payouts and reports from this console. Last 30 days unless noted.
        </p>
      </div>

      {s.openReports > 0 ? (
        <Link
          href="/502test/reports"
          className="block rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm font-semibold text-brand-2 transition hover:bg-brand/15"
        >
          {s.openReports} report{s.openReports === 1 ? "" : "s"} waiting for
          review →
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={s.users} sub={`+${s.newUsers7} this week`} />
        <Stat label="Active 24h" value={s.activeToday} />
        <Stat label="Live now" value={s.live} tone={s.live > 0 ? "good" : "default"} />
        <Stat
          label="Banned"
          value={s.banned}
          tone={s.banned > 0 ? "warn" : "default"}
          href="/502test/users?filter=banned"
        />
        <Stat
          label="Revenue (all time)"
          value={naira(s.revenueAllKobo)}
          tone="brand"
        />
        <Stat label="Revenue (30d)" value={naira(s.revenue30Kobo)} tone="brand" />
        <Stat
          label="Pending payments"
          value={s.pendingPayments}
          tone={s.pendingPayments > 0 ? "warn" : "default"}
          href="/502test/payments"
        />
        <Stat label="Failed payments" value={s.failedPayments} href="/502test/payments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Signups (30 days)">
          <Bars
            data={s.signupSeries.map((d) => ({ day: d.day, value: d.n }))}
            format={(v) => `${v} signup${v === 1 ? "" : "s"}`}
          />
          <p className="mt-3 text-xs text-muted">
            {s.newUsers30} in the last 30 days · {s.newUsers7} in the last 7
          </p>
        </Panel>

        <Panel title="Revenue (30 days)">
          <Bars
            data={s.revenueSeries.map((d) => ({ day: d.day, value: d.kobo }))}
            format={naira}
          />
          <p className="mt-3 text-xs text-muted">
            {naira(s.revenue30Kobo)} collected in the last 30 days
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Plans">
          <dl className="space-y-2 text-sm">
            <Row label="Free" value={s.freeCount} />
            <Row label="Plus" value={s.plusCount} />
            <Row label="Elite" value={s.eliteCount} />
            <Row label="Verified badges" value={s.verified} />
          </dl>
        </Panel>

        <Panel title="Engagement">
          <dl className="space-y-2 text-sm">
            <Row label="Swipes" value={s.swipes} />
            <Row label="Matches" value={s.matches} />
            <Row
              label="Match rate"
              value={`${(s.matchRate * 100).toFixed(1)}%`}
            />
            <Row label="Messages" value={s.messages} />
            <Row label="Posts" value={`${s.posts} (${s.hiddenPosts} hidden)`} />
          </dl>
        </Panel>

        <Panel title="Recent admin activity">
          {s.recentActions.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <ul className="space-y-2 text-xs">
              {s.recentActions.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="font-mono text-muted">{a.action}</span>
                  <span className="shrink-0 text-muted/70">
                    {a.createdAt.toLocaleString("en-NG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between border-b border-line/60 pb-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

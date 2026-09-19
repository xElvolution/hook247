import Link from "next/link";
import { Prisma, Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { banUser, unbanUser, suspendUser, setPlan } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Search = { q?: string; filter?: string; page?: string };

export default async function UsersPage({
  searchParams,
}: {
  // In Next 16 searchParams is a Promise and must be awaited.
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filter = params.filter ?? "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { profile: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (filter === "banned") where.bannedAt = { not: null };
  if (filter === "unverified") where.emailVerified = false;
  if (filter === "live") where.profile = { isLive: true };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { profile: true, _count: { select: { reportsAgainst: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-muted">{total} matching</p>
        </div>

        <form className="flex gap-2" action="/502test/users">
          <input
            name="q"
            defaultValue={q}
            placeholder="Email or display name"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input type="hidden" name="filter" value={filter} />
          <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand/50">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "banned", "unverified", "live"].map((f) => (
          <Link
            key={f}
            href={`/502test/users?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? "bg-brand text-white"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <Panel title="Accounts">
        {users.length === 0 ? (
          <Empty>No users match that search.</Empty>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const banned = u.bannedAt !== null;
              const suspended =
                u.suspendedUntil !== null && u.suspendedUntil > new Date();
              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-line/70 bg-surface/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {u.profile?.displayName ?? "— no profile —"}
                    </span>
                    <span className="text-sm text-muted">{u.email}</span>
                    {banned ? <Badge tone="bad">Banned</Badge> : null}
                    {suspended ? <Badge tone="warn">Suspended</Badge> : null}
                    {u.profile?.verified ? (
                      <Badge tone="good">Verified</Badge>
                    ) : null}
                    {u.profile?.isLive ? <Badge tone="brand">Live</Badge> : null}
                    {!u.emailVerified ? (
                      <Badge tone="warn">Email unconfirmed</Badge>
                    ) : null}
                    {u.profile ? <Badge>{u.profile.plan}</Badge> : null}
                    {u._count.reportsAgainst > 0 ? (
                      <Badge tone="bad">
                        {u._count.reportsAgainst} report
                        {u._count.reportsAgainst === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs text-muted">
                    Joined{" "}
                    {u.createdAt.toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {u.profile
                      ? ` · ${u.profile.city || u.profile.state || u.profile.country}`
                      : ""}
                    {banned && u.banReason ? ` · Ban reason: ${u.banReason}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {banned ? (
                      <form action={unbanUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Action tone="good">Unban</Action>
                      </form>
                    ) : (
                      <>
                        <form action={banUser} className="flex gap-1.5">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            name="reason"
                            placeholder="Ban reason"
                            required
                            className="w-40 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                          />
                          <Action tone="bad">Ban</Action>
                        </form>
                        <form action={suspendUser} className="flex gap-1.5">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            name="days"
                            type="number"
                            min={1}
                            max={365}
                            defaultValue={7}
                            className="w-16 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                          />
                          <Action tone="warn">Suspend (days)</Action>
                        </form>
                      </>
                    )}

                    {u.profile ? (
                      <form action={setPlan} className="flex gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="plan"
                          defaultValue={u.profile.plan}
                          className="rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                        >
                          {Object.values(Plan).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <Action>Set plan</Action>
                      </form>
                    ) : null}

                    {u.profile ? (
                      <Link
                        href={`/profiles/${u.id}`}
                        target="_blank"
                        className="text-xs font-medium text-muted underline hover:text-ink"
                      >
                        View profile
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/502test/users?page=${p}&filter=${filter}${
                q ? `&q=${encodeURIComponent(q)}` : ""
              }`}
              className={`rounded px-3 py-1.5 text-sm ${
                p === page
                  ? "bg-brand text-white"
                  : "border border-line text-muted hover:text-ink"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Action({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const cls = {
    default: "border-line text-muted hover:text-ink",
    good: "border-good/40 text-good hover:bg-good/10",
    warn: "border-amber-400/40 text-amber-300 hover:bg-amber-400/10",
    bad: "border-red-500/40 text-red-300 hover:bg-red-500/10",
  }[tone];
  return (
    <button
      type="submit"
      className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${cls}`}
    >
      {children}
    </button>
  );
}

import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Search = { q?: string; filter?: string; page?: string };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filter = params.filter ?? "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const now = new Date();

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
  if (filter === "hidden") where.profile = { adminHidden: true };
  if (filter === "expired") {
    where.profile = {
      OR: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { lte: now } }],
    };
  }

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
          <p className="mt-1 text-sm text-muted">
            Click a row to edit that account. {total} matching.
          </p>
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
        {["all", "banned", "unverified", "live", "hidden", "expired"].map((f) => (
          <Link
            key={f}
            href={`/502test/users?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f ? "bg-brand text-white" : "border border-line text-muted hover:text-ink"
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
          <div className="admin-list">
            {users.map((u) => {
              const banned = u.bannedAt !== null;
              const suspended = u.suspendedUntil !== null && u.suspendedUntil > now;
              const paid = Boolean(u.profile?.subscriptionExpiresAt && u.profile.subscriptionExpiresAt > now);
              return (
                <Link key={u.id} href={`/502test/users/${u.id}`} className="admin-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.profile?.avatarUrl || "/logo.png"} alt="" className="admin-row-avatar" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {u.profile?.displayName ?? "(no profile)"}
                      <span className="ml-2 font-normal text-muted">{u.email}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {u.profile?.city || u.profile?.state || "No city"}
                      {paid
                        ? ` · Paid until ${u.profile!.subscriptionExpiresAt!.toLocaleDateString("en-NG")}`
                        : " · No plan"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {banned ? <Badge tone="bad">Banned</Badge> : null}
                      {suspended ? <Badge tone="warn">Suspended</Badge> : null}
                      {u.profile?.adminHidden ? <Badge tone="bad">Hidden</Badge> : null}
                      {u.profile?.verified ? <Badge tone="good">Verified</Badge> : null}
                      {u.profile?.isLive ? <Badge tone="brand">Live</Badge> : null}
                      {u.profile ? <Badge>{u.profile.plan}</Badge> : null}
                      {u._count.reportsAgainst > 0 ? (
                        <Badge tone="bad">{u._count.reportsAgainst} reports</Badge>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </Link>
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
              href={`/502test/users?page=${p}&filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded px-3 py-1.5 text-sm ${
                p === page ? "bg-brand text-white" : "border border-line text-muted hover:text-ink"
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

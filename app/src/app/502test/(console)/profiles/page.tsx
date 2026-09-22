import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Search = { q?: string; filter?: string; page?: string };

export default async function ProfilesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const filter = params.filter ?? "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const now = new Date();

  const where: Prisma.ProfileWhereInput = { role: "ESCORT" };
  const extra: Prisma.ProfileWhereInput[] = [];
  if (q) {
    extra.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filter === "live") where.isLive = true;
  if (filter === "boosted") where.boostedUntil = { gt: now };
  if (filter === "hidden") where.adminHidden = true;
  if (filter === "active") where.subscriptionExpiresAt = { gt: now };
  if (filter === "expired") {
    extra.push({
      OR: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { lte: now } }],
    });
  }
  if (filter === "unverified") where.verified = false;
  if (extra.length) where.AND = extra;

  const [profiles, total] = await Promise.all([
    db.profile.findMany({
      where,
      include: { user: { select: { id: true, email: true, bannedAt: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.profile.count({ where }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Profiles</h1>
          <p className="mt-1 text-sm text-muted">
            Click a profile to open the editor. {total} matching.
          </p>
        </div>
        <form className="flex gap-2" action="/502test/profiles">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, city or email"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input type="hidden" name="filter" value={filter} />
          <button className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand/50">
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "active", "expired", "boosted", "live", "hidden", "unverified"].map((f) => (
          <Link
            key={f}
            href={`/502test/profiles?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f ? "bg-brand text-white" : "border border-line text-muted hover:text-ink"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <Panel title="Directory">
        {profiles.length === 0 ? (
          <Empty>No profiles match that search.</Empty>
        ) : (
          <div className="admin-list">
            {profiles.map((p) => {
              const active = Boolean(p.subscriptionExpiresAt && p.subscriptionExpiresAt > now);
              const boosted = Boolean(p.boostedUntil && p.boostedUntil > now);
              return (
                <Link key={p.id} href={`/502test/users/${p.userId}`} className="admin-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatarUrl || "/logo.png"} alt="" className="admin-row-photo" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.displayName}
                      <span className="ml-2 font-normal text-muted">{p.user.email}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {[p.city, p.state].filter(Boolean).join(", ") || "No city"}
                      {active
                        ? ` · Paid until ${p.subscriptionExpiresAt!.toLocaleDateString("en-NG")}`
                        : " · No plan"}
                      {` · ${p.photos.length} photos`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.user.bannedAt ? <Badge tone="bad">Banned</Badge> : null}
                      {p.adminHidden ? <Badge tone="bad">Hidden</Badge> : null}
                      {p.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}
                      {p.isLive ? <Badge tone="brand">Live</Badge> : null}
                      {boosted ? <Badge tone="brand">Boosted</Badge> : null}
                      {active ? <Badge tone="good">Paid</Badge> : <Badge>Unpaid</Badge>}
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
              href={`/502test/profiles?page=${p}&filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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

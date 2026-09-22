import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

/**
 * Groups of action strings, so the filter bar stays short as actions are added.
 * Each key maps to the prefix stored in AdminAction.action.
 */
const GROUPS: { key: string; label: string; prefix?: string }[] = [
  { key: "all", label: "All" },
  { key: "user", label: "Accounts", prefix: "user." },
  { key: "post", label: "Content", prefix: "post." },
  { key: "report", label: "Reports", prefix: "report." },
  { key: "verification", label: "Verification", prefix: "verification." },
  { key: "payment", label: "Payments", prefix: "payment." },
  { key: "admin", label: "Sign-ins", prefix: "admin." },
];

/** Colour the row by how much damage the action could do if it was not you. */
function toneFor(action: string): "muted" | "good" | "warn" | "bad" | "brand" {
  if (action.endsWith(".ban") || action.endsWith(".hide")) return "bad";
  if (action.endsWith(".suspend") || action.endsWith(".revoke")) return "warn";
  if (
    action.endsWith(".unban") ||
    action.endsWith(".unhide") ||
    action.endsWith(".approve") ||
    action.endsWith(".resolved")
  ) {
    return "good";
  }
  if (action.startsWith("payment.")) return "brand";
  return "muted";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; page?: string }>;
}) {
  const params = await searchParams;
  const group = params.group ?? "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const prefix = GROUPS.find((g) => g.key === group)?.prefix;
  const where: Prisma.AdminActionWhereInput = prefix
    ? { action: { startsWith: prefix } }
    : {};

  const [actions, total] = await Promise.all([
    db.adminAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.adminAction.count({ where }),
  ]);

  // The log stores bare ids so it stays writable even after the target is gone.
  // Resolve the ones that still exist in two queries rather than per row.
  const userIds = actions
    .filter((a) => a.targetType === "user")
    .map((a) => a.targetId);
  const postIds = actions
    .filter((a) => a.targetType === "post")
    .map((a) => a.targetId);

  const [users, posts] = await Promise.all([
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        })
      : [],
    postIds.length
      ? db.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, body: true },
        })
      : [],
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const postById = new Map(posts.map((p) => [p.id, p]));
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-muted">
          Every action taken from this console, append-only. {total} entr
          {total === 1 ? "y" : "ies"} recorded.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={`/502test/audit?group=${g.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              group === g.key
                ? "bg-brand text-white"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {g.label}
          </Link>
        ))}
      </div>

      <Panel title="History">
        {actions.length === 0 ? (
          <Empty>Nothing logged under that filter yet.</Empty>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => {
              const user = a.targetType === "user" ? userById.get(a.targetId) : null;
              const post = a.targetType === "post" ? postById.get(a.targetId) : null;

              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-line/70 bg-surface/50 px-3 py-2 text-sm"
                >
                  <Badge tone={toneFor(a.action)}>{a.action}</Badge>

                  <span className="text-muted">
                    {a.createdAt.toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>

                  {user ? (
                    <Link
                      href={`/502test/users?q=${encodeURIComponent(user.email)}`}
                      className="font-medium underline decoration-line hover:decoration-brand"
                    >
                      {user.profile?.displayName ?? user.email}
                    </Link>
                  ) : post ? (
                    <span className="truncate">
                      post “{post.body.slice(0, 60)}”
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted">
                      {a.targetType}:{a.targetId}
                      {a.targetType === "user" || a.targetType === "post"
                        ? " (deleted)"
                        : ""}
                    </span>
                  )}

                  {a.note ? (
                    <span className="text-muted">: {a.note}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: Math.min(pages, 20) }, (_, i) => i + 1).map(
            (p) => (
              <Link
                key={p}
                href={`/502test/audit?group=${group}&page=${p}`}
                className={`rounded px-3 py-1.5 text-sm ${
                  p === page
                    ? "bg-brand text-white"
                    : "border border-line text-muted hover:text-ink"
                }`}
              >
                {p}
              </Link>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { ReportStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { resolveReport, banUser, hidePost, unhidePost, deletePost } from "../actions";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "all", label: "All" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "OPEN";

  const reports = await db.report.findMany({
    where:
      status === "all" ? {} : { status: status as ReportStatus },
    include: {
      reporter: { select: { email: true, profile: { select: { displayName: true } } } },
      reportedUser: {
        select: {
          id: true,
          email: true,
          bannedAt: true,
          profile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Reports can point at a post, which lives in a different table — fetch the
  // referenced bodies in one query rather than per row.
  const postIds = reports
    .map((r) => r.targetPostId)
    .filter((id): id is string => Boolean(id));
  const posts = postIds.length
    ? await db.post.findMany({
        where: { id: { in: postIds } },
        select: {
          id: true,
          body: true,
          hiddenAt: true,
          hideReason: true,
          imageUrl: true,
          videoUrl: true,
          category: true,
        },
      })
    : [];
  const postById = new Map(posts.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          {reports.length} shown{reports.length === 100 ? " (capped at 100)" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/502test/reports?status=${t.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              status === t.key
                ? "bg-brand text-white"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Panel title="Queue">
        {reports.length === 0 ? (
          <Empty>Nothing here. That is the good outcome.</Empty>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const post = r.targetPostId ? postById.get(r.targetPostId) : null;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-line/70 bg-surface/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="bad">{r.reason}</Badge>
                    <Badge>{r.targetType}</Badge>
                    <Badge
                      tone={
                        r.status === "OPEN"
                          ? "warn"
                          : r.status === "RESOLVED"
                            ? "good"
                            : "muted"
                      }
                    >
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted">
                      {r.createdAt.toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="mt-2 text-sm">
                    <span className="text-muted">Reported by</span>{" "}
                    {r.reporter.profile?.displayName ?? r.reporter.email}
                    {r.reportedUser ? (
                      <>
                        {" "}
                        <span className="text-muted">against</span>{" "}
                        <span className="font-semibold">
                          {r.reportedUser.profile?.displayName ??
                            r.reportedUser.email}
                        </span>
                        {r.reportedUser.bannedAt ? (
                          <Badge tone="bad">already banned</Badge>
                        ) : null}
                      </>
                    ) : null}
                  </p>

                  {r.details ? (
                    <p className="mt-1.5 rounded bg-bg/60 p-2 text-sm text-muted">
                      “{r.details}”
                    </p>
                  ) : null}

                  {post ? (
                    <div className="mt-1.5 rounded bg-bg/60 p-2 text-sm">
                      <p>
                        <span className="text-muted">Post:</span> {post.body.slice(0, 240) || <em className="text-muted">no text</em>}{" "}
                        {post.category === "erotica" ? <Badge tone="warn">erotica</Badge> : null}{" "}
                        {post.hiddenAt ? <Badge tone="muted">hidden</Badge> : null}
                      </p>
                      {post.hideReason ? (
                        <p className="mt-1 text-xs text-amber-300">{post.hideReason}</p>
                      ) : null}
                      {post.videoUrl ? (
                        <video src={post.videoUrl} controls preload="metadata" className="mt-2 max-h-56 rounded" />
                      ) : post.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.imageUrl} alt="Reported media" className="mt-2 max-h-56 rounded object-contain" />
                      ) : null}
                    </div>
                  ) : r.targetPostId ? (
                    <p className="mt-1.5 text-xs text-muted">The reported post has been deleted.</p>
                  ) : null}

                  {r.status === "OPEN" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={resolveReport} className="flex gap-1.5">
                        <input type="hidden" name="reportId" value={r.id} />
                        <input type="hidden" name="status" value="RESOLVED" />
                        <input
                          name="resolution"
                          placeholder="What did you do?"
                          className="w-48 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                        />
                        <Btn tone="good">Resolve</Btn>
                      </form>

                      <form action={resolveReport}>
                        <input type="hidden" name="reportId" value={r.id} />
                        <input type="hidden" name="status" value="DISMISSED" />
                        <input type="hidden" name="resolution" value="No action needed" />
                        <Btn>Dismiss</Btn>
                      </form>

                      {r.reportedUser && !r.reportedUser.bannedAt ? (
                        <form action={banUser}>
                          <input type="hidden" name="userId" value={r.reportedUser.id} />
                          <input
                            type="hidden"
                            name="reason"
                            value={`Report: ${r.reason}`}
                          />
                          <Btn tone="bad">Ban reported user</Btn>
                        </form>
                      ) : null}

                      {post && post.hiddenAt ? (
                        <form action={unhidePost}>
                          <input type="hidden" name="postId" value={post.id} />
                          <Btn tone="good">Restore post</Btn>
                        </form>
                      ) : null}

                      {post ? (
                        <form action={deletePost}>
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="reason" value={`Report: ${r.reason}`} />
                          <Btn tone="bad">Delete post</Btn>
                        </form>
                      ) : null}

                      {post && !post.hiddenAt ? (
                        <form action={hidePost}>
                          <input type="hidden" name="postId" value={post.id} />
                          <input
                            type="hidden"
                            name="reason"
                            value={`Report: ${r.reason}`}
                          />
                          <Btn tone="warn">Take post down</Btn>
                        </form>
                      ) : null}
                    </div>
                  ) : r.resolution ? (
                    <p className="mt-2 text-xs text-muted">
                      Resolution: {r.resolution}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Btn({
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

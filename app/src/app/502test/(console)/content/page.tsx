import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { hidePost, unhidePost } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "visible";

  const where: Prisma.PostWhereInput =
    filter === "hidden"
      ? { hiddenAt: { not: null } }
      : filter === "all"
        ? {}
        : { hiddenAt: null };

  const posts = await db.post.findMany({
    where,
    include: {
      author: {
        select: {
          id: true,
          email: true,
          bannedAt: true,
          profile: { select: { displayName: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Content</h1>
        <p className="mt-1 text-sm text-muted">
          Newest 60 posts. Taking a post down keeps the row for the audit trail
          and hides it from the feed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["visible", "hidden", "all"].map((f) => (
          <Link
            key={f}
            href={`/502test/content?filter=${f}`}
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

      <Panel title="Posts">
        {posts.length === 0 ? (
          <Empty>No posts match that filter.</Empty>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-line/70 bg-surface/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {p.author.profile?.displayName ?? p.author.email}
                  </span>
                  {p.hiddenAt ? <Badge tone="bad">Hidden</Badge> : null}
                  {p.author.bannedAt ? (
                    <Badge tone="bad">Author banned</Badge>
                  ) : null}
                  <span className="text-xs text-muted">
                    {p.createdAt.toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {p._count.likes} likes · {p._count.comments} comments
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm">{p.body}</p>

                {p.imageUrl ? (
                  <p className="mt-1 truncate text-xs text-muted">
                    Image: {p.imageUrl}
                  </p>
                ) : null}
                {p.hideReason ? (
                  <p className="mt-1 text-xs text-muted">
                    Taken down: {p.hideReason}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {p.hiddenAt ? (
                    <form action={unhidePost}>
                      <input type="hidden" name="postId" value={p.id} />
                      <Btn tone="good">Restore</Btn>
                    </form>
                  ) : (
                    <form action={hidePost} className="flex gap-1.5">
                      <input type="hidden" name="postId" value={p.id} />
                      <input
                        name="reason"
                        placeholder="Takedown reason"
                        required
                        className="w-44 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <Btn tone="bad">Take down</Btn>
                    </form>
                  )}
                </div>
              </div>
            ))}
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
  tone?: "default" | "good" | "bad";
}) {
  const cls = {
    default: "border-line text-muted hover:text-ink",
    good: "border-good/40 text-good hover:bg-good/10",
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

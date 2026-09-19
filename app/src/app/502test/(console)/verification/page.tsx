import Link from "next/link";
import { VerificationSource } from "@prisma/client";
import { db } from "@/lib/db";
import { Panel, Badge, Empty } from "@/components/admin/Ui";
import { approveVerification, revokeVerification } from "../actions";

export const dynamic = "force-dynamic";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "paid";

  const where =
    filter === "paid"
      ? { verified: true, verifiedSource: VerificationSource.PAID }
      : filter === "reviewed"
        ? { verifiedSource: VerificationSource.REVIEWED }
        : { verified: true };

  const profiles = await db.profile.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, bannedAt: true } },
    },
    orderBy: { verifiedAt: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Verification</h1>
        <p className="mt-1 text-sm text-muted">
          Paid = bought the badge with no review. Reviewed = you approved it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["paid", "reviewed", "all"].map((f) => (
          <Link
            key={f}
            href={`/502test/verification?filter=${f}`}
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

      <Panel title="Verified badges">
        {profiles.length === 0 ? (
          <Empty>No verified profiles match that filter.</Empty>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-line/70 bg-surface/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.displayName}</span>
                  <span className="text-sm text-muted">{p.user.email}</span>
                  <Badge
                    tone={
                      p.verifiedSource === VerificationSource.REVIEWED
                        ? "good"
                        : "warn"
                    }
                  >
                    {p.verifiedSource}
                  </Badge>
                  {p.user.bannedAt ? <Badge tone="bad">Banned</Badge> : null}
                </div>

                <p className="mt-1 text-xs text-muted">
                  {p.city || p.state || p.country}
                  {p.verifiedAt
                    ? ` · Badge granted ${p.verifiedAt.toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>

                {p.verifyNote ? (
                  <p className="mt-1 text-xs text-muted">Note: {p.verifyNote}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {p.verified ? (
                    <form action={revokeVerification} className="flex gap-1.5">
                      <input type="hidden" name="userId" value={p.userId} />
                      <input
                        name="note"
                        placeholder="Revoke reason"
                        className="w-44 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <Btn tone="bad">Revoke</Btn>
                    </form>
                  ) : (
                    <form action={approveVerification} className="flex gap-1.5">
                      <input type="hidden" name="userId" value={p.userId} />
                      <input
                        name="note"
                        placeholder="Approval note"
                        className="w-44 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <Btn tone="good">Approve</Btn>
                    </form>
                  )}

                  <Link
                    href={`/profiles/${p.userId}`}
                    target="_blank"
                    className="text-xs font-medium text-muted underline hover:text-ink"
                  >
                    View profile
                  </Link>
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

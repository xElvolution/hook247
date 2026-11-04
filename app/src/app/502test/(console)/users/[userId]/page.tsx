import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { Panel, Badge, AdminBtn } from "@/components/admin/Ui";
import GrantPicker from "@/components/admin/GrantPicker";
import {
  banUser,
  unbanUser,
  suspendUser,
  setGiftingDisabled,
  setPayoutsFrozen,
  grantSubscription,
  grantBoost,
  hideProfile,
  showProfile,
  setLive,
  approveVerification,
  revokeVerification,
} from "../../actions";

export const dynamic = "force-dynamic";

function when(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UserEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { userId } = await params;
  const flash = await searchParams;
  const [plans, boosts] = await Promise.all([
    db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.boostProduct.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { services: true } },
      _count: { select: { reportsAgainst: true, referrals: true } },
    },
  });
  if (!user) notFound();

  const p = user.profile;
  const now = new Date();
  const banned = user.bannedAt !== null;
  const suspended = user.suspendedUntil !== null && user.suspendedUntil > now;
  const paid = Boolean(p?.subscriptionExpiresAt && p.subscriptionExpiresAt > now);
  const boosted = Boolean(p?.boostedUntil && p.boostedUntil > now);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/502test/users" className="admin-back">
          <ArrowLeft className="h-4 w-4" /> Users
        </Link>
        <Link href="/502test/profiles" className="text-xs text-muted hover:text-ink">
          Profiles
        </Link>
      </div>

      <section className="admin-edit-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p?.avatarUrl || "/logo.png"} alt="" className="admin-edit-avatar" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">{p?.displayName ?? "No profile yet"}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {banned ? <Badge tone="bad">Banned</Badge> : null}
            {suspended ? <Badge tone="warn">Suspended</Badge> : null}
            {p?.adminHidden ? <Badge tone="bad">Hidden</Badge> : null}
            {p?.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Unverified</Badge>}
            {p?.isLive ? <Badge tone="brand">Live</Badge> : null}
            {boosted ? <Badge tone="brand">Boosted</Badge> : null}
            {paid ? <Badge tone="good">Paid</Badge> : p ? <Badge>Unpaid</Badge> : null}
            {p ? <Badge>{p.plan}</Badge> : null}
            {!user.emailVerified ? <Badge tone="warn">Email unconfirmed</Badge> : null}
          </div>
        </div>
        {p ? (
          <Link href={`/profiles/${user.id}`} target="_blank" className="admin-back">
            Public page
          </Link>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {p ? (
          <Panel title="Plan">
            {flash.sent ? <p className="mb-2 text-sm text-emerald-300">{flash.sent}</p> : null}
            {flash.error ? <p className="mb-2 text-sm text-red-300">{flash.error}</p> : null}
            <p className="text-sm text-muted">
              {paid
                ? `Listed until ${when(p.subscriptionExpiresAt)}`
                : "No active plan."}
              {boosted ? ` Boosted until ${when(p.boostedUntil)}.` : " No active boost."}
            </p>
            <div className="mt-3">
              <GrantPicker
                userId={user.id}
                plans={plans.map((plan) => ({ id: plan.id, name: plan.name, priceLabel: nairaFromKobo(plan.priceKobo) }))}
                boosts={boosts.map((boost) => ({ id: boost.id, name: boost.name, priceLabel: nairaFromKobo(boost.priceKobo) }))}
                grantPlan={grantSubscription}
                grantBoost={grantBoost}
              />
            </div>
          </Panel>
        ) : null}

        {p ? (
          <Panel title="Visibility">
            <p className="text-sm text-muted">
              Hidden profiles leave public browse immediately. Live rooms only show when live is on.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.adminHidden ? (
                <form action={showProfile}>
                  <input type="hidden" name="userId" value={user.id} />
                  <AdminBtn tone="good">Show on board</AdminBtn>
                </form>
              ) : (
                <form action={hideProfile}>
                  <input type="hidden" name="userId" value={user.id} />
                  <AdminBtn tone="bad">Hide from board</AdminBtn>
                </form>
              )}
              <form action={setLive}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="live" value={p.isLive ? "0" : "1"} />
                <AdminBtn>{p.isLive ? "Take live off" : "Put live"}</AdminBtn>
              </form>
            </div>
          </Panel>
        ) : null}

        {p ? (
          <Panel title="Verification">
            <p className="text-sm text-muted">
              {p.verified
                ? `Badge on · ${p.verifiedSource}${p.verifiedAt ? ` · ${when(p.verifiedAt)}` : ""}`
                : "No verified badge."}
            </p>
            {p.verifyNote ? <p className="mt-1 text-xs text-muted">Note: {p.verifyNote}</p> : null}
            {p.verified ? (
              <form action={revokeVerification} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <input name="note" placeholder="Revoke reason" className="input flex-1" />
                <AdminBtn tone="bad">Unverify</AdminBtn>
              </form>
            ) : (
              <form action={approveVerification} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <input name="note" placeholder="Approval note" className="input flex-1" />
                <AdminBtn tone="good">Verify</AdminBtn>
              </form>
            )}
          </Panel>
        ) : null}

        <Panel title="Account">
          <dl className="space-y-1.5 text-sm">
            <Row label="Joined" value={when(user.createdAt)} />
            <Row label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
            <Row label="Referrals" value={String(user._count.referrals)} />
            <Row label="Reports against" value={String(user._count.reportsAgainst)} />
            {banned ? <Row label="Ban reason" value={user.banReason || "—"} /> : null}
            {suspended ? <Row label="Suspended until" value={when(user.suspendedUntil)} /> : null}
            <Row label="Gifting" value={user.giftingDisabled ? "Disabled" : "Allowed"} />
            <Row label="Withdrawals" value={user.payoutsFrozen ? "Frozen" : "Allowed"} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={setGiftingDisabled}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="disabled" value={user.giftingDisabled ? "0" : "1"} />
              <AdminBtn tone={user.giftingDisabled ? "good" : "warn"}>{user.giftingDisabled ? "Allow gifting" : "Disable gifting"}</AdminBtn>
            </form>
            <form action={setPayoutsFrozen}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="frozen" value={user.payoutsFrozen ? "0" : "1"} />
              <AdminBtn tone={user.payoutsFrozen ? "good" : "warn"}>{user.payoutsFrozen ? "Unfreeze withdrawals" : "Freeze withdrawals"}</AdminBtn>
            </form>
            <Link href={`/502test/transactions?user=${user.id}&kind=all`} className="rounded border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">
              Transactions
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {banned ? (
              <form action={unbanUser}>
                <input type="hidden" name="userId" value={user.id} />
                <AdminBtn tone="good">Unban</AdminBtn>
              </form>
            ) : (
              <>
                <form action={banUser} className="flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <input name="reason" required placeholder="Ban reason" className="input flex-1" />
                  <AdminBtn tone="bad">Ban</AdminBtn>
                </form>
                <form action={suspendUser} className="flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <input name="days" type="number" min={1} max={365} defaultValue={7} className="input w-24" />
                  <AdminBtn tone="warn">Suspend days</AdminBtn>
                </form>
              </>
            )}
          </div>
        </Panel>

        {p ? (
          <Panel title="Profile details">
            <dl className="space-y-1.5 text-sm">
              <Row label="Role" value={p.role} />
              <Row label="City" value={[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"} />
              <Row label="WhatsApp" value={p.whatsapp || "—"} />
              <Row label="Photos" value={String(p.photos.length)} />
              <Row label="Clips" value={String(p.clips.length)} />
              <Row label="Views" value={String(p.profileViews)} />
            </dl>
            {p.photos.length > 0 ? (
              <div className="admin-thumbs mt-3">
                {p.photos.slice(0, 8).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" />
                ))}
              </div>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

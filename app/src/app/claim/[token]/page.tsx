import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { claimBonusAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { token } = await params;
  const flash = await searchParams;
  const claim = await db.bonusClaim.findUnique({ where: { token } });
  const userId = await getSessionUserId();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="section-kicker">Flirta247</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Claim your bonus</h1>
      {!claim ? (
        <p className="mt-3 text-sm text-muted">This claim link is not valid.</p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Congratulations. You have been granted a bonus from the Flirta247 team.
          </p>
          <p className="mt-3 font-display text-xl font-bold">{claim.label}</p>
          {flash.ok ? <p className="mt-3 text-sm text-emerald-300">{flash.ok}</p> : null}
          {flash.error ? <p className="mt-3 text-sm text-red-300">{flash.error}</p> : null}
          {claim.claimedAt && !flash.ok ? (
            <p className="mt-3 text-sm text-muted">This bonus is already on the account.</p>
          ) : null}
          {!userId ? (
            <Link href={`/login?next=/claim/${encodeURIComponent(token)}`} className="btn-primary mt-6 text-sm">
              Sign in to claim it
            </Link>
          ) : !claim.claimedAt ? (
            <form action={claimBonusAction} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn-primary text-sm">Click to claim it</button>
            </form>
          ) : (
            <Link href="/profile" className="btn-primary mt-6 text-sm">Open your profile</Link>
          )}
        </>
      )}
    </div>
  );
}

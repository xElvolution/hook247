import Link from "next/link";
import { BadgeCheck, Check, Gift, Lock, UserPlus, Users } from "lucide-react";
import { getActiveSessionUserId } from "@/lib/user";
import { guestRewardNotice, welcomeNotice } from "@/lib/welcome";
import PromoCopyLink from "@/components/PromoCopyLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "₦5,000 Welcome Reward · Flirta247" };

export default async function PromoPage() {
  const userId = await getActiveSessionUserId();
  const n = userId ? await welcomeNotice(userId).catch(() => ({ show: false as const })) : await guestRewardNotice().catch(() => ({ show: false as const }));

  if (!n.show) {
    return (
      <div className="promo-page">
        <section className="promo-hero">
          <div className="promo-badge"><Gift className="h-7 w-7" /></div>
          <h1 className="promo-title">This promo has ended</h1>
          <p className="promo-sub">The welcome reward is not open right now. Check back soon.</p>
          <Link href="/" className="promo-cta">Back to profiles</Link>
        </section>
      </div>
    );
  }

  const pct = n.required ? Math.round((n.qualified / n.required) * 100) : 0;
  const steps = [
    { done: n.state !== "guest", icon: <UserPlus className="h-4 w-4" />, label: "Sign up for free" },
    { done: n.state === "refer", icon: <BadgeCheck className="h-4 w-4" />, label: "Verify your face" },
    { done: n.qualified >= n.required, icon: <Users className="h-4 w-4" />, label: `Refer ${n.required} people who sign up` },
  ];

  return (
    <div className="promo-page">
      <section className="promo-hero">
        <span className="promo-tag">Limited promo</span>
        <div className="promo-badge"><Gift className="h-7 w-7" /></div>
        <p className="promo-kicker">Welcome reward</p>
        <h1 className="promo-amount">{n.amountLabel}</h1>
        <p className="promo-sub">
          {n.state === "refer"
            ? `Copy your special referral link and refer ${n.required} people who sign up to claim your ${n.amountLabel}.`
            : n.state === "verify"
              ? `Verify your face, then refer ${n.required} people who sign up to claim your ${n.amountLabel}.`
              : `Sign up, verify your face, then refer ${n.required} people who sign up to claim your ${n.amountLabel}.`}
        </p>
      </section>

      <section className="promo-card">
        <ol className="promo-steps">
          {steps.map((s, i) => (
            <li key={s.label} className={s.done ? "is-done" : ""}>
              <span className="promo-step-icon">{s.done ? <Check className="h-4 w-4" /> : s.icon}</span>
              <span><small>Step {i + 1}</small>{s.label}</span>
            </li>
          ))}
        </ol>

        {n.state === "guest" ? (
          <>
            <Link href="/signup" className="promo-cta">Sign up to claim</Link>
            <Link href="/login" className="promo-later">I already have an account</Link>
          </>
        ) : n.state === "verify" ? (
          <>
            <p className="promo-private"><Lock className="h-3.5 w-3.5" /> Private. Your photo and video are never posted or shared.</p>
            <Link href="/verify" className="promo-cta">Verify now</Link>
          </>
        ) : (
          <>
            <div className="promo-progress" aria-label={`${n.qualified} of ${n.required} referrals`}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Your referrals</span>
                <span>{n.qualified}/{n.required}</span>
              </div>
              <div className="promo-bar"><span style={{ width: `${pct}%` }} /></div>
            </div>
            {n.link ? <PromoCopyLink link={n.link} code={n.code} /> : null}
            <p className="promo-note">A referral counts once they sign up and verify their face. When you reach {n.required}/{n.required}, withdraw from your referral dashboard.</p>
            <Link href="/referrals" className="promo-later">Open referral dashboard</Link>
          </>
        )}
      </section>
    </div>
  );
}

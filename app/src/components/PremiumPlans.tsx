"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Crown, Check, Loader2 } from "lucide-react";
import DojahVerify from "@/components/DojahVerify";

type Purpose = "PLAN_PLUS" | "PLAN_ELITE" | "BOOST";

const PLANS = [
  {
    purpose: "PLAN_PLUS" as Purpose,
    name: "Plus",
    price: "₦2,500",
    period: "/month",
    tagline: "For the serious swiper",
    features: [
      "See who likes you",
      "Unlimited likes",
      "1 free Boost per week",
      "Plus badge on your profile",
    ],
    highlight: false,
  },
  {
    purpose: "PLAN_ELITE" as Purpose,
    name: "Elite",
    price: "₦6,000",
    period: "/month",
    tagline: "Main character energy",
    features: [
      "Everything in Plus",
      "Unlimited Boosts",
      "Priority in every deck",
      "Elite crown badge",
      "Early access to new features",
    ],
    highlight: true,
  },
];

export default function PremiumPlans({
  userId,
  currentPlan,
  verified,
  paymentPending,
  paymentComplete,
  dojah,
}: {
  userId: string;
  currentPlan: "FREE" | "PLUS" | "ELITE";
  verified: boolean;
  /** Paystack redirected back but the purchase has not activated yet. */
  paymentPending: boolean;
  /** The purchase was confirmed and applied during this request. */
  paymentComplete: boolean;
  /** Public Dojah widget config for the verification card. */
  dojah: { appId: string; publicKey: string; widgetId: string };
}) {
  const [busy, setBusy] = useState<Purpose | "">("");
  const [error, setError] = useState("");

  async function checkout(purpose: Purpose) {
    setBusy(purpose);
    setError("");

    const res = await fetch("/api/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout", purpose }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.checkoutUrl) {
      setBusy("");
      setError(data.error ?? "Could not start checkout. Please try again.");
      return;
    }
    // Hand off to Paystack. `busy` stays set so buttons remain disabled
    // through the redirect. assign() rather than setting location.href: the
    // compiler's immutability rule treats the assignment as mutating a value
    // defined outside the component.
    window.location.assign(data.checkoutUrl);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-center text-3xl font-extrabold md:text-4xl">
        Level up your <span className="text-gradient">luck</span>
      </h1>
      <p className="mt-3 text-center text-muted">
        Secure checkout by Paystack. Card, bank transfer, and USSD accepted.
      </p>

      {paymentComplete && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="mx-auto mt-5 max-w-md rounded-2xl bg-emerald-500/10 px-5 py-3 text-center text-sm text-emerald-400"
        >
          Payment confirmed — your purchase is active. A receipt is on its way
          to your inbox.
        </motion.p>
      )}
      {paymentPending && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="mx-auto mt-5 max-w-md rounded-2xl border border-line bg-white/5 px-5 py-3 text-center text-sm"
        >
          Payment received. Your purchase activates within a few seconds —
          reload the page if you don&apos;t see it yet.
        </motion.p>
      )}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="mx-auto mt-5 max-w-md rounded-2xl bg-red-500/10 px-5 py-3 text-center text-sm text-red-400"
        >
          {error}
        </motion.p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {PLANS.map((plan, index) => {
          const active =
            (plan.purpose === "PLAN_PLUS" && currentPlan === "PLUS") ||
            (plan.purpose === "PLAN_ELITE" && currentPlan === "ELITE");

          return (
            <motion.div
              key={plan.purpose}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-[2rem] p-[1.5px] ${
                plan.highlight
                  ? "bg-gradient-to-b from-[#ff2d78] to-[#ff6b2c]"
                  : "bg-white/10"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff2d78] to-[#ff6b2c] px-4 py-1 text-xs font-bold">
                  MOST POPULAR
                </span>
              )}
              <div className="h-full rounded-[2rem] bg-[#120c1a] p-7">
                <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                  {plan.name}
                  {plan.purpose === "PLAN_ELITE" && (
                    <Crown className="h-5 w-5 text-amber-400" />
                  )}
                </h2>
                <p className="text-sm text-muted">{plan.tagline}</p>
                <p className="mt-4">
                  <span className="font-display text-4xl font-extrabold">
                    {plan.price}
                  </span>
                  <span className="text-muted">{plan.period}</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5d52]" />{" "}
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => checkout(plan.purpose)}
                  disabled={!!busy || active}
                  className={`${
                    plan.highlight ? "btn-primary" : "btn-ghost"
                  } mt-7 w-full`}
                >
                  {active ? (
                    "Your current plan"
                  ) : busy === plan.purpose ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
                    </>
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display flex items-center gap-2 font-bold">
            <Zap className="h-4 w-4 text-[#ff5d52]" /> Profile Boost
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            ₦1,500 — jump to the front of everyone&apos;s deck for an hour.
            Requires Plus or Elite.
          </p>
          <button
            type="button"
            onClick={() => checkout("BOOST")}
            disabled={!!busy}
            className="btn-ghost mt-4 w-full !py-2.5 text-sm"
          >
            {busy === "BOOST" ? "Redirecting…" : "Boost me now"}
          </button>
        </div>
        <DojahVerify
          userId={userId}
          appId={dojah.appId}
          publicKey={dojah.publicKey}
          widgetId={dojah.widgetId}
          verified={verified}
        />
      </div>
    </div>
  );
}

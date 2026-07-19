"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Crown, Check, BadgeCheck } from "lucide-react";

const PLANS = [
  {
    id: "PLUS",
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
    id: "ELITE",
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
] as const;

export default function PremiumPage() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState("");

  async function act(action: "upgrade" | "boost" | "verify", plan?: string) {
    setBusy(action + (plan ?? ""));
    const res = await fetch("/api/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, plan }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setDone(data.error ?? "Something went wrong");
      return;
    }
    setDone(
      action === "upgrade"
        ? `You're on ${plan} now!`
        : action === "boost"
        ? "Boosted! You're first in the deck for the next hour."
        : "You're verified!"
    );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-center text-3xl font-extrabold md:text-4xl">
        Level up your <span className="text-gradient">luck</span>
      </h1>
      <p className="mt-3 text-center text-muted">
        Demo mode: buttons below activate features instantly — hook up
        Paystack/Stripe for real billing.
      </p>

      {done && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-5 max-w-md rounded-2xl bg-white/5 border border-line px-5 py-3 text-center text-sm"
        >
          {done}
        </motion.p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {PLANS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`relative rounded-[2rem] p-[1.5px] ${
              p.highlight
                ? "bg-gradient-to-b from-[#ff2d78] to-[#ff6b2c]"
                : "bg-white/10"
            }`}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#ff2d78] to-[#ff6b2c] px-4 py-1 text-xs font-bold">
                MOST POPULAR
              </span>
            )}
            <div className="h-full rounded-[2rem] bg-[#120c1a] p-7">
              <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                {p.name}
                {p.id === "ELITE" && <Crown className="h-5 w-5 text-amber-400" />}
              </h2>
              <p className="text-sm text-muted">{p.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-4xl font-extrabold">{p.price}</span>
                <span className="text-muted">{p.period}</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff5d52]" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => act("upgrade", p.id)}
                disabled={!!busy}
                className={`${p.highlight ? "btn-primary" : "btn-ghost"} mt-7 w-full`}
              >
                {busy === `upgrade${p.id}` ? "Activating…" : `Get ${p.name}`}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* one-off actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display flex items-center gap-2 font-bold">
            <Zap className="h-4 w-4 text-[#ff5d52]" /> Profile Boost
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            Jump to the front of everyone&apos;s deck. Requires Plus or Elite.
          </p>
          <button
            onClick={() => act("boost")}
            disabled={!!busy}
            className="btn-ghost mt-4 w-full !py-2.5 text-sm"
          >
            {busy === "boost" ? "Boosting…" : "Boost me now"}
          </button>
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display flex items-center gap-2 font-bold">
            <BadgeCheck className="h-4 w-4 text-sky-400" /> Get verified
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            Show everyone you&apos;re real. In production this runs an ID +
            selfie check.
          </p>
          <button
            onClick={() => act("verify")}
            disabled={!!busy}
            className="btn-ghost mt-4 w-full !py-2.5 text-sm"
          >
            {busy === "verify" ? "Verifying…" : "Verify my profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

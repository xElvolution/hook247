"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import DojahVerify from "./DojahVerify";
import { formatKobo } from "@/lib/profileOptions";

type Plan = {
  id: string;
  name: string;
  durationDays: number;
  priceKobo: number;
};
type Boost = {
  id: string;
  name: string;
  durationHours: number;
  priceKobo: number;
};

export default function PremiumPlans({
  userId,
  verified,
  paymentPending,
  paymentComplete,
  subscriptionLabel,
  dojah,
}: {
  userId: string;
  currentPlan: "FREE" | "PLUS" | "ELITE";
  verified: boolean;
  paymentPending: boolean;
  paymentComplete: boolean;
  subscriptionLabel: string;
  dojah: { appId: string; publicKey: string; widgetId: string };
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) return;
    fetch("/api/premium/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/catalog")
      .then((response) => response.json())
      .then((data) => {
        setPlans(data.plans ?? []);
        setBoosts(data.boosts ?? []);
      })
      .catch(() => setError("Could not load plans."));
  }, []);

  async function checkout(kind: "plan" | "boost", productId: string) {
    setBusy(productId);
    setError("");
    const res = await fetch("/api/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout", kind, productId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkoutUrl) {
      setBusy("");
      setError(data.error ?? "Could not start checkout.");
      return;
    }
    window.location.assign(data.checkoutUrl);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-center text-3xl font-extrabold md:text-4xl">
        Keep your profile <span className="text-gradient">live</span>
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
        {subscriptionLabel || "Pay to activate your profile. Boost sits at the front of search."}
      </p>

      {paymentComplete && (
        <p className="mt-5 rounded-xl bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
          Payment confirmed. Your profile is updated.
        </p>
      )}
      {paymentPending && (
        <p className="mt-5 rounded-xl bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
          Payment received. Activation can take a few seconds.
        </p>
      )}
      {error && (
        <p className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">{error}</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted">{plan.durationDays} days</p>
            <h2 className="font-display mt-1 text-2xl font-bold">{plan.name}</h2>
            <p className="mt-2 text-xl font-semibold">{formatKobo(plan.priceKobo)}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted">
              <li className="flex gap-2"><Check className="h-4 w-4 text-[#df3a6a]" /> Profile stays live</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-[#df3a6a]" /> WhatsApp on your profile</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-[#df3a6a]" /> Eligible for boosts</li>
            </ul>
            <button
              type="button"
              className="btn-primary mt-5 w-full text-sm"
              disabled={!!busy}
              onClick={() => void checkout("plan", plan.id)}
            >
              {busy === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatKobo(plan.priceKobo)}`}
            </button>
          </div>
        ))}
      </div>

      {boosts.map((boost) => (
        <div key={boost.id} className="mt-6 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold">
            <Zap className="h-5 w-5 text-[#df3a6a]" /> {boost.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {boost.durationHours / 24} days at the front of search. Requires an active profile plan.
          </p>
          <button
            type="button"
            className="btn-primary mt-5 w-full text-sm"
            disabled={!!busy}
            onClick={() => void checkout("boost", boost.id)}
          >
            {busy === boost.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatKobo(boost.priceKobo)}`}
          </button>
        </div>
      ))}

      <div className="mt-8">
        <DojahVerify userId={userId} verified={verified} appId={dojah.appId} publicKey={dojah.publicKey} widgetId={dojah.widgetId} />
      </div>
    </div>
  );
}

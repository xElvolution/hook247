"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Item = { id: string; name: string; priceLabel: string };

export default function GrantPicker({
  userId,
  plans,
  boosts,
  grantPlan,
  grantBoost,
}: {
  userId: string;
  plans: Item[];
  boosts: Item[];
  grantPlan: (formData: FormData) => Promise<void>;
  grantBoost: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
        Top up plan
      </button>
      {open ? (
        <div className="grant-pop-root" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="grant-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grant-pop-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="grant-pop-title" className="font-display text-lg font-bold">Give this member a plan</h2>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">Choose a plan. It is added now, and they get an email that they have been rewarded.</p>
            <ul className="mt-4 space-y-2">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <form action={grantPlan}>
                    <input type="hidden" name="userId" value={userId} />
                    <input type="hidden" name="productId" value={plan.id} />
                    <button type="submit" className="grant-pop-choice">
                      <span>{plan.name}</span>
                      <strong>{plan.priceLabel}</strong>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            {boosts.length ? (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Boost</p>
                <ul className="mt-2 space-y-2">
                  {boosts.map((boost) => (
                    <li key={boost.id}>
                      <form action={grantBoost}>
                        <input type="hidden" name="userId" value={userId} />
                        <input type="hidden" name="productId" value={boost.id} />
                        <button type="submit" className="grant-pop-choice">
                          <span>{boost.name}</span>
                          <strong>{boost.priceLabel}</strong>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { LiveGiftEvent } from "./types";

type Shown = LiveGiftEvent & { key: string; big: boolean };

/** Animated gift banners shown to everyone in the room. */
export default function GiftOverlay({ gifts }: { gifts: LiveGiftEvent[] }) {
  const [shown, setShown] = useState<Shown[]>([]);
  const [seen] = useState(() => new Set<string>());

  useEffect(() => {
    const fresh = gifts.filter((g) => !seen.has(g.id));
    if (!fresh.length) return;
    fresh.forEach((g) => seen.add(g.id));
    const items = fresh.map((g) => ({ ...g, key: `${g.id}`, big: g.coins >= 200 }));
    setShown((current) => [...current, ...items].slice(-4));
    const timers = items.map((item) =>
      window.setTimeout(() => setShown((current) => current.filter((s) => s.key !== item.key)), item.big ? 4200 : 3000)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [gifts, seen]);

  const spotlight = shown.find((s) => s.big);

  return (
    <div className="gift-overlay" aria-live="polite">
      <div className="gift-banners">
        {shown.map((g) => (
          <div key={g.key} className="gift-banner">
            <span className="gift-banner-emoji" aria-hidden="true">{g.emoji}</span>
            <span>
              <strong>{g.name}</strong>
              <small>sent {g.giftName} · {g.coins.toLocaleString("en-NG")} {g.coins === 1 ? "coin" : "coins"}</small>
            </span>
          </div>
        ))}
      </div>
      {spotlight ? (
        <div key={spotlight.key} className="gift-spotlight" aria-hidden="true">
          <span>{spotlight.emoji}</span>
        </div>
      ) : null}
      {shown
        .filter((g) => !g.big)
        .map((g) => (
          <span key={`float-${g.key}`} className="gift-float" aria-hidden="true">{g.emoji}</span>
        ))}
    </div>
  );
}

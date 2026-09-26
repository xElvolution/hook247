"use client";

import { useEffect, useState } from "react";
import type { LiveGiftEvent } from "./types";

type Effect = "float" | "pulse" | "burst" | "spotlight" | "royal";
type Shown = LiveGiftEvent & { key: string; effect: Effect };

const DURATION: Record<Effect, number> = { float: 3000, pulse: 3200, burst: 3400, spotlight: 4200, royal: 5200 };
const EFFECTS = new Set<Effect>(["float", "pulse", "burst", "spotlight", "royal"]);

/** Older gifts carry no effect name, so fall back on their size. */
function effectFor(gift: LiveGiftEvent): Effect {
  if (gift.animation && EFFECTS.has(gift.animation as Effect)) return gift.animation as Effect;
  if (gift.coins >= 2000) return "royal";
  if (gift.coins >= 500) return "spotlight";
  if (gift.coins >= 50) return "burst";
  if (gift.coins >= 10) return "pulse";
  return "float";
}

const BURST_PARTS = Array.from({ length: 8 }, (_, i) => i);

/** Animated gift banners and effects shown to everyone in the room. */
export default function GiftOverlay({ gifts }: { gifts: LiveGiftEvent[] }) {
  const [shown, setShown] = useState<Shown[]>([]);
  const [seen] = useState(() => new Set<string>());

  useEffect(() => {
    const fresh = gifts.filter((g) => !seen.has(g.id));
    if (!fresh.length) return;
    fresh.forEach((g) => seen.add(g.id));
    const items = fresh.map((g) => ({ ...g, key: g.id, effect: effectFor(g) }));
    setShown((current) => [...current, ...items].slice(-4));
    const timers = items.map((item) =>
      window.setTimeout(() => setShown((current) => current.filter((s) => s.key !== item.key)), DURATION[item.effect])
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [gifts, seen]);

  // Only one full screen moment at a time; the grandest wins.
  const stage =
    shown.find((s) => s.effect === "royal") ?? shown.find((s) => s.effect === "spotlight") ?? shown.find((s) => s.effect === "burst");

  return (
    <div className="gift-overlay" aria-live="polite">
      <div className="gift-banners">
        {shown.map((g) => (
          <div key={g.key} className={`gift-banner gift-banner-${g.effect}`}>
            <span className="gift-banner-emoji" aria-hidden="true">{g.emoji}</span>
            <span>
              <strong>{g.name}</strong>
              <small>
                sent {g.giftName}, {g.coins.toLocaleString("en-NG")} {g.coins === 1 ? "coin" : "coins"}
              </small>
            </span>
          </div>
        ))}
      </div>

      {stage?.effect === "royal" ? (
        <div key={stage.key} className="gift-royal" aria-hidden="true">
          <span className="gift-royal-ring" />
          <span className="gift-royal-emoji">{stage.emoji}</span>
          <strong className="gift-royal-caption">{stage.giftName} from {stage.name}</strong>
        </div>
      ) : stage?.effect === "spotlight" ? (
        <div key={stage.key} className="gift-spotlight" aria-hidden="true">
          <span>{stage.emoji}</span>
        </div>
      ) : stage?.effect === "burst" ? (
        <div key={stage.key} className="gift-burst" aria-hidden="true">
          <span className="gift-burst-core">{stage.emoji}</span>
          {BURST_PARTS.map((i) => (
            <span key={i} className="gift-burst-part" style={{ ["--angle" as string]: `${i * 45}deg` }}>{stage.emoji}</span>
          ))}
        </div>
      ) : null}

      {shown
        .filter((g) => g.effect === "float" || g.effect === "pulse")
        .map((g) => (
          <span key={`fx-${g.key}`} className={g.effect === "pulse" ? "gift-pulse" : "gift-float"} aria-hidden="true">
            {g.emoji}
          </span>
        ))}
    </div>
  );
}

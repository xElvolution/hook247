"use client";

import { useState } from "react";
import { EyeOff, Radio } from "lucide-react";

/** Explicit photo or video that stays blurred until the viewer taps to reveal it. */
export default function BlurredMedia({
  imageUrl,
  videoUrl,
  posterUrl,
  explicit,
}: {
  imageUrl: string;
  videoUrl: string;
  posterUrl: string;
  explicit: boolean;
}) {
  const [revealed, setRevealed] = useState(!explicit);
  if (!imageUrl && !videoUrl) return null;
  const hidden = explicit && !revealed;

  return (
    <div className={`pulse-media ${videoUrl ? "pulse-video" : ""} ${explicit ? "explicit-media" : ""}`} data-hidden={hidden}>
      {videoUrl ? (
        <video controls={!hidden} playsInline preload="metadata" poster={posterUrl || undefined}>
          <source src={videoUrl} type={videoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" />
      )}
      {videoUrl && !hidden ? (
        <span className="pulse-media-label"><Radio className="h-3 w-3" /> Video</span>
      ) : null}
      {hidden ? (
        <button type="button" className="explicit-cover" onClick={() => setRevealed(true)}>
          <EyeOff className="h-6 w-6" />
          <strong>Explicit {videoUrl ? "video" : "photo"}</strong>
          <span>Tap to reveal</span>
        </button>
      ) : explicit ? (
        <button type="button" className="explicit-rehide" onClick={() => setRevealed(false)}>
          Hide
        </button>
      ) : null}
    </div>
  );
}

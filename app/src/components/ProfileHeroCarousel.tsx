"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export default function ProfileHeroCarousel({
  items,
  name,
  availableLabel,
}: {
  items: string[];
  name: string;
  availableLabel?: string;
}) {
  const slides = items.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const current = slides[index] ?? "";

  function go(next: number) {
    if (slides.length < 2) return;
    setIndex((next + slides.length) % slides.length);
  }

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => go(index + 1), 3500);
    return () => window.clearInterval(timer);
  }, [index, paused, slides.length]);

  function pointerDown(clientX: number) {
    startX.current = clientX;
    setPaused(true);
  }

  function pointerUp(clientX: number) {
    if (startX.current == null) return;
    const dx = clientX - startX.current;
    startX.current = null;
    if (dx < -40) go(index + 1);
    else if (dx > 40) go(index - 1);
    window.setTimeout(() => setPaused(false), 4000);
  }

  if (!current) return null;

  return (
    <div className="profile-carousel-wrap">
      <section
        className="profile-carousel"
        onTouchStart={(event) => pointerDown(event.touches[0]?.clientX ?? 0)}
        onTouchEnd={(event) => pointerUp(event.changedTouches[0]?.clientX ?? 0)}
        onMouseDown={(event) => pointerDown(event.clientX)}
        onMouseUp={(event) => pointerUp(event.clientX)}
        aria-label={`${name} photos`}
      >
        {isVideo(current) ? (
          <video src={current} controls playsInline className="profile-carousel-media" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={`${name} photo ${index + 1}`} className="profile-carousel-media" draggable={false} />
        )}

        {availableLabel && <span className="profile-carousel-live">{availableLabel}</span>}

        {slides.length > 1 && (
          <>
            <button type="button" className="profile-carousel-nav prev" onClick={() => go(index - 1)} aria-label="Previous photo">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" className="profile-carousel-nav next" onClick={() => go(index + 1)} aria-label="Next photo">
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="profile-carousel-dots">
              {slides.map((slide, i) => (
                <button
                  key={slide + i}
                  type="button"
                  data-active={i === index}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <span className="profile-carousel-count">
              {index + 1}/{slides.length}
            </span>
          </>
        )}
      </section>

      {slides.length > 1 && (
        <div className="profile-carousel-thumbs">
          {slides.map((slide, i) => (
            <button
              key={`thumb-${slide}-${i}`}
              type="button"
              className="profile-carousel-thumb"
              data-active={i === index}
              onClick={() => setIndex(i)}
            >
              {isVideo(slide) ? (
                <video src={slide} muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Eye, MapPin, Radio, RefreshCw, X } from "lucide-react";
import type { LiveListing } from "@/lib/live";

function since(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just started";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function LiveDirectory({
  authed,
  canGoLive,
  lives,
}: {
  authed: boolean;
  canGoLive: boolean;
  lives: LiveListing[];
}) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [router]);

  return (
    <main className="live-lobby">
      <header className="live-lobby-top">
        <Link href="/feed" aria-label="Close live" className="stream-icon-button"><X className="h-5 w-5" /></Link>
        <div>
          <strong>Hooks247 Live</strong>
          <small>{lives.length ? `${lives.length} live now` : "No one live yet"}</small>
        </div>
        {canGoLive ? (
          <Link href="/live/go" className="live-go-button"><Radio className="h-4 w-4" /> Go live</Link>
        ) : (
          <button type="button" className="stream-icon-button" onClick={() => router.refresh()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
        )}
      </header>

      {!authed ? (
        <p className="live-lobby-hint">
          <Link href="/login?next=/live">Sign in</Link> to watch lives, chat and send gifts.
        </p>
      ) : null}

      {lives.length === 0 ? (
        <section className="live-lobby-empty">
          <Radio className="h-8 w-8" />
          <h1>Nobody is live right now</h1>
          <p>{canGoLive ? "Be the first. Go live and earn coins from gifts." : "Lives show up here the moment an escort starts streaming."}</p>
          {canGoLive ? <Link href="/live/go" className="btn-primary text-sm">Start a live</Link> : <Link href="/feed" className="btn-primary text-sm">Back to feed</Link>}
        </section>
      ) : (
        <section className="live-lobby-grid">
          {lives.map((live) => (
            <Link key={live.sessionId} href={`/live/${encodeURIComponent(live.host.userId)}`} className="live-card" aria-label={`Watch ${live.host.displayName} live`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {live.host.avatarUrl ? <img src={live.host.avatarUrl} alt="" /> : <span className="live-card-initial">{live.host.displayName.slice(0, 1)}</span>}
              <span className="live-card-shade" />
              <span className="live-card-top">
                <i><Radio className="h-3 w-3" /> LIVE</i>
                <em><Eye className="h-3 w-3" /> {live.viewers.toLocaleString("en-NG")}</em>
              </span>
              <span className="live-card-body">
                <b>{live.title}</b>
                <span>
                  {live.host.displayName}, {live.host.age}
                  {live.host.verified ? <BadgeCheck className="h-3.5 w-3.5 fill-[#df3a6a] text-white" /> : null}
                </span>
                <small><MapPin className="h-3 w-3" /> {live.host.city || live.host.state}{now !== null ? ` · ${since(live.startedAt, now)}` : ""}</small>
              </span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

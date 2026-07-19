"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Eye, Heart, MapPin, MessageCircle, Radio, Share2, UserRound, X } from "lucide-react";
import type { LiveHost } from "@/components/LiveStreamViewer";

function LiveFeedRoom({ authed, host, index }: { authed: boolean; host: LiveHost; index: number }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const viewers = 420 + host.displayName.charCodeAt(0) * 5 + index * 83;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.65 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function requireAccount() {
    router.push(`/signup?next=${encodeURIComponent("/live")}`);
  }

  async function share() {
    const url = `${window.location.origin}/live/${encodeURIComponent(host.userId)}`;
    if (navigator.share) await navigator.share({ title: `${host.displayName} is live`, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url).catch(() => undefined);
  }

  return (
    <section className="live-feed-room" aria-label={`${host.displayName}'s live room`}>
      <div className="live-feed-backdrop" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={host.avatarUrl} alt="" />
      </div>
      <div className="live-feed-layout">
        <aside className="live-feed-host-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={host.avatarUrl} alt={host.displayName} />
          <h2>{host.displayName}, {host.age} {host.verified && <BadgeCheck className="h-4 w-4 fill-[#df3a6a] text-white" />}</h2>
          <p><MapPin className="h-3.5 w-3.5" /> {[host.city, host.state].filter(Boolean).join(", ")}</p>
          <div>{host.interests.slice(0, 3).map((interest) => <span key={interest}>#{interest}</span>)}</div>
          <Link href={`/profiles/${encodeURIComponent(host.userId)}`}><UserRound className="h-4 w-4" /> View profile</Link>
        </aside>

        <div className="live-feed-stage">
          <video ref={videoRef} muted loop playsInline poster={host.avatarUrl} preload={index < 2 ? "auto" : "metadata"}>
            <source src="/demo-live.mp4" type="video/mp4" />
          </video>
          <div className="live-feed-stage-header">
            <span><Radio className="h-3 w-3" /> LIVE</span>
            <small><Eye className="h-3.5 w-3.5" /> {new Intl.NumberFormat("en").format(viewers)}</small>
          </div>
          <div className="live-feed-mobile-host">
            <strong>{host.displayName}, {host.age}</strong>
            <Link href={`/profiles/${encodeURIComponent(host.userId)}`}>View profile</Link>
          </div>
          <div className="live-feed-actions">
            <button type="button" onClick={() => authed ? setLiked((current) => !current) : requireAccount()} aria-label={`Like ${host.displayName}'s live`}>
              <Heart className={`h-5 w-5 ${liked ? "fill-[#df3a6a] text-[#df3a6a]" : ""}`} /><span>{liked ? "Liked" : "Like"}</span>
            </button>
            <button type="button" onClick={() => authed ? undefined : requireAccount()} aria-label="Join live chat"><MessageCircle className="h-5 w-5" /><span>Chat</span></button>
            <button type="button" onClick={share} aria-label="Share live room"><Share2 className="h-5 w-5" /><span>Share</span></button>
          </div>
        </div>

        <aside className="live-feed-chat-preview">
          <h3><MessageCircle className="h-4 w-4" /> Live chat</h3>
          <div>
            <p><strong>Tomi</strong> The energy is perfect tonight.</p>
            <p><strong>Amaka</strong> Watching from Abuja.</p>
            <p><strong>Jay</strong> This is a vibe.</p>
            <p><strong>Mo</strong> Love the setup.</p>
          </div>
          <button type="button" onClick={() => authed ? router.push(`/live/${host.userId}`) : requireAccount()}>{authed ? "Open chat" : "Sign in to chat"}</button>
        </aside>
      </div>
    </section>
  );
}

export default function LiveDirectory({ authed, hosts }: { authed: boolean; hosts: LiveHost[] }) {
  return (
    <main className="live-feed">
      <header className="live-feed-topbar">
        <Link href="/" aria-label="Close live feed"><X className="h-5 w-5" /></Link>
        <strong>Hook247 Live</strong>
        <span>{hosts.length} rooms</span>
      </header>
      <div className="live-feed-scroller">
        {hosts.map((host, index) => <LiveFeedRoom key={host.userId} authed={authed} host={host} index={index} />)}
      </div>
    </main>
  );
}

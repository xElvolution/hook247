"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Eye,
  Heart,
  MapPin,
  MessageCircle,
  Radio,
  Send,
  Share2,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

export type LiveHost = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  state: string;
  avatarUrl: string;
  bio: string;
  interests: string[];
  services: string[];
  verified: boolean;
};

type ChatMessage = { id: string; author: string; body: string };

const STARTING_MESSAGES: ChatMessage[] = [
  { id: "welcome", author: "Hook247", body: "Welcome to the live room." },
  { id: "1", author: "Tomi", body: "The energy tonight is perfect." },
  { id: "2", author: "Ada", body: "Hey from Lagos!" },
  { id: "3", author: "Jay", body: "That playlist is a serious vibe." },
  { id: "4", author: "Mira", body: "Love the look." },
];

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function LiveStreamViewer({
  authed,
  host,
  initialViewers,
}: {
  authed: boolean;
  host: LiveHost;
  initialViewers: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(258);
  const [viewers, setViewers] = useState(initialViewers);
  const [reactions, setReactions] = useState(3200 + initialViewers);
  const [messages, setMessages] = useState(STARTING_MESSAGES);
  const [draft, setDraft] = useState("");
  const [muted, setMuted] = useState(true);
  const [notice, setNotice] = useState("");
  const returnTo = `/live/${encodeURIComponent(host.userId)}`;

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    const audience = window.setInterval(() => {
      setViewers((current) => Math.max(1, current + Math.floor(Math.random() * 7) - 3));
    }, 4500);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(audience);
    };
  }, []);

  function requireAccount() {
    window.location.assign(`/signup?next=${encodeURIComponent(returnTo)}`);
  }

  function react() {
    if (!authed) return requireAccount();
    setReactions((current) => current + 1);
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    if (!authed) return requireAccount();
    setMessages((current) => [...current, { id: `mine-${Date.now()}`, author: "You", body: body.slice(0, 160) }]);
    setDraft("");
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) videoRef.current.muted = nextMuted;
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `${host.displayName} is live`, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setNotice("Live link copied");
      window.setTimeout(() => setNotice(""), 2200);
    } catch {
      setNotice("");
    }
  }

  return (
    <main className="stream-room">
      <div className="stream-background" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={host.avatarUrl} alt="" />
      </div>

      <header className="stream-header">
        <Link href="/" className="stream-icon-button" aria-label="Close live room"><X className="h-5 w-5" /></Link>
        <strong className="stream-brand">Hook<span>247</span></strong>
        <span className="stream-live-badge"><Radio className="h-3 w-3" /> LIVE</span>
        <div className="stream-stats">
          <span><Eye className="h-4 w-4" /> {new Intl.NumberFormat("en").format(viewers)}</span>
          <time>{formatElapsed(elapsed)}</time>
        </div>
      </header>

      <div className="stream-layout">
        <aside className="stream-host-panel">
          <div className="stream-host-identity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={host.avatarUrl} alt={host.displayName} />
            <div>
              <h1>{host.displayName}, {host.age} {host.verified && <BadgeCheck className="h-4 w-4 fill-[#df3a6a] text-white" />}</h1>
              <p><MapPin className="h-3.5 w-3.5" /> {[host.city, host.state].filter(Boolean).join(", ")}</p>
            </div>
          </div>
          <p className="stream-host-bio">{host.bio}</p>
          <div className="stream-host-tags">
            {host.interests.slice(0, 4).map((interest) => <span key={interest}>#{interest}</span>)}
          </div>
          {host.services.length > 0 && (
            <div className="stream-service-preview">
              <small>Published services</small>
              {host.services.slice(0, 3).map((service) => <span key={service}>{service}</span>)}
            </div>
          )}
          <Link href={`/profiles/${encodeURIComponent(host.userId)}`} className="btn-primary mt-auto w-full text-sm">
            <UserRound className="h-4 w-4" /> View full profile
          </Link>
        </aside>

        <section className="stream-stage" aria-label={`${host.displayName}'s live stream`}>
          <video ref={videoRef} autoPlay muted loop playsInline poster={host.avatarUrl}>
            <source src="/demo-live.mp4" type="video/mp4" />
          </video>
          <div className="stream-stage-top">
            <span><Radio className="h-3 w-3" /> Live preview</span>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute stream" : "Mute stream"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <div className="stream-mobile-host">
            <h1>{host.displayName}, {host.age}</h1>
            <p><MapPin className="h-3.5 w-3.5" /> {host.city}</p>
            <Link href={`/profiles/${encodeURIComponent(host.userId)}`}>View profile</Link>
          </div>
          <nav className="stream-action-rail" aria-label="Live actions">
            <button type="button" onClick={react} aria-label="React to live stream">
              <Heart className="h-5 w-5" /><span>{new Intl.NumberFormat("en", { notation: "compact" }).format(reactions)}</span>
            </button>
            <button type="button" onClick={share} aria-label="Share live stream">
              <Share2 className="h-5 w-5" /><span>Share</span>
            </button>
          </nav>
        </section>

        <aside className="stream-chat-panel">
          <div className="stream-chat-header">
            <span><MessageCircle className="h-4 w-4" /> Live chat</span>
            <small>{authed ? "Connected" : "Guest viewing"}</small>
          </div>
          <div className="stream-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <p key={message.id}><strong>{message.author}</strong><span>{message.body}</span></p>
            ))}
          </div>
          <form className="stream-chat-form" onSubmit={submitComment}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={160} placeholder={authed ? "Add a comment" : "Sign in to join chat"} aria-label="Live comment" />
            <button type="submit" aria-label="Send comment"><Send className="h-4 w-4" /></button>
          </form>
        </aside>
      </div>

      {notice && <div className="stream-notice" role="status">{notice}</div>}
    </main>
  );
}

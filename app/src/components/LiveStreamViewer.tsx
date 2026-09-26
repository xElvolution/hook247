"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
} from "livekit-client";
import { BadgeCheck, Eye, Gift as GiftIcon, Loader2, MapPin, Radio, RefreshCw, Share2, UserRound, Volume2, VolumeX, X } from "lucide-react";
import LiveChatPanel from "@/components/live/LiveChatPanel";
import GiftOverlay from "@/components/live/GiftOverlay";
import GiftSheet from "@/components/live/GiftSheet";
import {
  compact,
  formatElapsed,
  newNonce,
  parseLiveEvent,
  type Gift,
  type LiveComment,
  type LiveGiftEvent,
  type LiveState,
} from "@/components/live/types";

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

type Phase = "loading" | "connecting" | "live" | "waiting" | "ended" | "error";

export default function LiveStreamViewer({
  authed,
  host,
  session,
}: {
  authed: boolean;
  host: LiveHost;
  session: { id: string; title: string; startedAt: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [phase, setPhase] = useState<Phase>(authed ? "loading" : "ended");
  const [error, setError] = useState("");
  const [viewers, setViewers] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [giftEvents, setGiftEvents] = useState<LiveGiftEvent[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [balance, setBalance] = useState(0);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [muted, setMuted] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [sendingGift, setSendingGift] = useState<string | null>(null);
  const pendingGift = useRef<{ giftId: string; nonce: string } | null>(null);
  const [giftError, setGiftError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const returnTo = `/live/${encodeURIComponent(host.userId)}`;

  useEffect(() => {
    const tick = () => setElapsed((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session.startedAt]);

  const addComment = useCallback((c: LiveComment) => {
    setComments((current) => (current.some((x) => x.id === c.id) ? current : [...current, c].slice(-150)));
  }, []);

  const countViewers = useCallback((room: Room) => {
    let n = 1; // this viewer
    room.remoteParticipants.forEach((p) => {
      if (p.identity !== host.userId) n += 1;
    });
    setViewers(n);
    const hostHere = Array.from(room.remoteParticipants.values()).some((p) => p.identity === host.userId);
    setPhase((current) => (current === "ended" || current === "error" ? current : hostHere ? "live" : "waiting"));
  }, [host.userId]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attach = (track: RemoteTrack, participant: RemoteParticipant) => {
      if (participant.identity !== host.userId) return;
      if (track.kind === Track.Kind.Video && videoRef.current) track.attach(videoRef.current);
      if (track.kind === Track.Kind.Audio && audioRef.current) track.attach(audioRef.current);
    };

    room
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => attach(track, participant))
      .on(RoomEvent.TrackUnsubscribed, (track) => track.detach())
      .on(RoomEvent.ParticipantConnected, () => countViewers(room))
      .on(RoomEvent.ParticipantDisconnected, () => countViewers(room))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!room.canPlaybackAudio))
      .on(RoomEvent.DataReceived, (payload) => {
        const event = parseLiveEvent(payload);
        if (!event) return;
        if (event.t === "comment") addComment(event);
        else if (event.t === "gift") setGiftEvents((current) => [...current, event].slice(-30));
        else if (event.t === "ended") {
          setPhase("ended");
          room.disconnect();
        }
      })
      .on(RoomEvent.Disconnected, (reason) => {
        if (cancelled) return;
        if (reason === DisconnectReason.ROOM_DELETED) {
          setPhase("ended");
          return;
        }
        setPhase((current) => (current === "ended" ? current : "error"));
        setError((current) => current || "Connection lost.");
      });

    (async () => {
      try {
        const stateRes = await fetch(`/api/live/${session.id}`, { cache: "no-store" });
        const state = (await stateRes.json()) as LiveState & { error?: string };
        if (cancelled) return;
        if (!stateRes.ok) throw new Error(state.error || "Could not open this live");
        setComments(state.comments);
        setGifts(state.gifts);
        setBalance(state.balance);
        if (state.status !== "LIVE") {
          setPhase("ended");
          return;
        }
        setPhase("connecting");
        const tokenRes = await fetch(`/api/live/${session.id}/token`, { method: "POST" });
        const grant = await tokenRes.json();
        if (!tokenRes.ok) {
          if (tokenRes.status === 410) {
            setPhase("ended");
            return;
          }
          throw new Error(grant.error || "Could not join this live");
        }
        if (cancelled) return;
        await room.connect(grant.url, grant.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setNeedsAudio(!room.canPlaybackAudio);
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.isSubscribed) attach(pub.track as RemoteTrack, participant);
          });
        });
        countViewers(room);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || "Could not join this live");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
    };
  }, [authed, session.id, host.userId, attempt, addComment, countViewers]);

  useEffect(() => {
    if (phase !== "waiting") return;
    // While the host is away, ask the server now and then; it closes lives whose host never returns.
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/live/${session.id}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (data?.status === "ENDED") {
        setPhase("ended");
        roomRef.current?.disconnect();
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [phase, session.id]);

  async function enableAudio() {
    await roomRef.current?.startAudio().catch(() => undefined);
    setNeedsAudio(false);
    setMuted(false);
    if (audioRef.current) audioRef.current.muted = false;
  }

  function toggleMute() {
    if (needsAudio) return void enableAudio();
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  }

  async function sendComment(body: string) {
    const res = await fetch(`/api/live/${session.id}/comment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res) return "Network error. Try again.";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Could not send your comment";
    if (data.comment) addComment(data.comment);
    return null;
  }

  async function sendGift(gift: Gift) {
    if (sendingGift) return;
    if (gift.coins > balance) {
      setGiftError(`You need ${gift.coins.toLocaleString("en-NG")} coins for a ${gift.name}. Top up to send it.`);
      return;
    }
    setSendingGift(gift.id);
    setGiftError("");
    // Reuse the key if the last try for this gift never got an answer, so a retry cannot charge twice.
    const nonce = pendingGift.current?.giftId === gift.id ? pendingGift.current.nonce : newNonce();
    pendingGift.current = { giftId: gift.id, nonce };
    try {
      const res = await fetch(`/api/live/${session.id}/gift`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ giftId: gift.id, nonce }),
      });
      const data = await res.json().catch(() => ({}));
      pendingGift.current = null;
      if (!res.ok) {
        setGiftError(data.error || "Could not send that gift");
        return;
      }
      setBalance(data.balance);
      setGiftOpen(false);
    } catch {
      setGiftError("Network error. Try again.");
    } finally {
      setSendingGift(null);
    }
  }

  async function share() {
    const url = `${window.location.origin}${returnTo}`;
    try {
      if (navigator.share) await navigator.share({ title: `${host.displayName} is live`, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Live link copied");
        window.setTimeout(() => setNotice(""), 2200);
      }
    } catch {
      // share sheet dismissed
    }
  }

  const statusLabel =
    phase === "live" ? `${viewers.toLocaleString("en-NG")} watching` :
    phase === "waiting" ? "Host reconnecting" :
    phase === "ended" ? "Live ended" :
    phase === "error" ? "Disconnected" : "Connecting";

  return (
    <main className="stream-room">
      <div className="stream-background" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {host.avatarUrl ? <img src={host.avatarUrl} alt="" /> : null}
      </div>

      <header className="stream-header">
        <Link href="/live" className="stream-icon-button" aria-label="Close live room"><X className="h-5 w-5" /></Link>
        <strong className="stream-brand">Hooks<span>247</span></strong>
        {phase !== "ended" || !authed ? <span className="stream-live-badge"><Radio className="h-3 w-3" /> LIVE</span> : null}
        {phase !== "ended" ? (
          <div className="stream-stats">
            {authed ? <span><Eye className="h-4 w-4" /> {compact.format(viewers)}</span> : null}
            {elapsed !== null ? <time>{formatElapsed(elapsed)}</time> : null}
          </div>
        ) : null}
      </header>

      <div className="stream-layout">
        <aside className="stream-host-panel">
          <div className="stream-host-identity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {host.avatarUrl ? <img src={host.avatarUrl} alt={host.displayName} /> : <span className="live-avatar-fallback">{host.displayName.slice(0, 1)}</span>}
            <div>
              <h1>{host.displayName}, {host.age} {host.verified && <BadgeCheck className="h-4 w-4 fill-[#df3a6a] text-white" />}</h1>
              <p><MapPin className="h-3.5 w-3.5" /> {[host.city, host.state].filter(Boolean).join(", ")}</p>
            </div>
          </div>
          <p className="live-title-line">{session.title}</p>
          {host.bio ? <p className="stream-host-bio">{host.bio}</p> : null}
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
          <video ref={videoRef} autoPlay playsInline muted poster={host.avatarUrl || undefined} />
          <audio ref={audioRef} autoPlay />

          {phase !== "live" ? (
            <div className="live-stage-state">
              {!authed ? (
                <>
                  <strong>{host.displayName} is live</strong>
                  <p>Sign in to watch, chat and send gifts.</p>
                  <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-primary text-sm">Sign in to watch</Link>
                </>
              ) : phase === "ended" ? (
                <>
                  <strong>This live has ended</strong>
                  <p>Catch {host.displayName} next time, or say hi on their profile.</p>
                  <div className="live-stage-actions">
                    <Link href={`/profiles/${encodeURIComponent(host.userId)}`} className="btn-primary text-sm">View profile</Link>
                    <Link href="/live" className="live-ghost-button">More lives</Link>
                  </div>
                </>
              ) : phase === "error" ? (
                <>
                  <strong>Could not load the stream</strong>
                  <p>{error}</p>
                  <button type="button" className="btn-primary text-sm" onClick={() => { setError(""); setAttempt((n) => n + 1); }}>
                    <RefreshCw className="h-4 w-4" /> Try again
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p>{phase === "waiting" ? `${host.displayName} is reconnecting...` : "Joining the live..."}</p>
                </>
              )}
            </div>
          ) : null}

          <div className="stream-stage-top">
            <span className="live-title-chip"><Radio className="h-3 w-3" /> {session.title}</span>
            {authed && phase !== "ended" ? (
              <button type="button" onClick={toggleMute} aria-label={muted || needsAudio ? "Unmute stream" : "Mute stream"}>
                {muted || needsAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
          </div>

          {needsAudio && phase === "live" ? (
            <button type="button" className="live-unmute" onClick={enableAudio}>
              <Volume2 className="h-4 w-4" /> Tap for sound
            </button>
          ) : null}

          <GiftOverlay gifts={giftEvents} />

          <div className="stream-mobile-host">
            <h1>{host.displayName}, {host.age}</h1>
            <p><MapPin className="h-3.5 w-3.5" /> {host.city}</p>
            <Link href={`/profiles/${encodeURIComponent(host.userId)}`}>View profile</Link>
          </div>
          <nav className="stream-action-rail" aria-label="Live actions">
            {authed && phase !== "ended" ? (
              <button type="button" onClick={() => { setGiftError(""); setGiftOpen(true); }} aria-label="Send a gift">
                <GiftIcon className="h-5 w-5" /><span>Gift</span>
              </button>
            ) : null}
            <button type="button" onClick={share} aria-label="Share live stream">
              <Share2 className="h-5 w-5" /><span>Share</span>
            </button>
          </nav>
        </section>

        {authed ? (
          <LiveChatPanel
            comments={comments}
            hostId={host.userId}
            status={statusLabel}
            disabled={phase === "ended"}
            onSend={sendComment}
          />
        ) : (
          <aside className="stream-chat-panel">
            <div className="stream-chat-header"><span>Live chat</span><small>Members only</small></div>
            <div className="live-stage-state is-inline">
              <p>Sign in to read and join the chat.</p>
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-primary text-sm">Sign in</Link>
            </div>
          </aside>
        )}
      </div>

      {giftOpen ? (
        <GiftSheet
          gifts={gifts}
          balance={balance}
          sendingId={sendingGift}
          error={giftError}
          onSend={sendGift}
          onClose={() => setGiftOpen(false)}
        />
      ) : null}
      {notice && <div className="stream-notice" role="status">{notice}</div>}
    </main>
  );
}

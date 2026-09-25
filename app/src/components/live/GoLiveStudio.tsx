"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  createLocalTracks,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalAudioTrack,
  type LocalTrack,
  type LocalVideoTrack,
} from "livekit-client";
import { Coins, Eye, Loader2, Mic, MicOff, Radio, RefreshCw, SwitchCamera, Trophy, Video, VideoOff, X } from "lucide-react";
import LiveChatPanel from "./LiveChatPanel";
import GiftOverlay from "./GiftOverlay";
import { formatElapsed, parseLiveEvent, type LiveComment, type LiveGiftEvent, type LiveSummary } from "./types";

type Stage = "setup" | "starting" | "live" | "ending" | "summary";

export default function GoLiveStudio({
  hostId,
  displayName,
  avatarUrl,
  payoutKoboPerCoin,
  resume,
}: {
  hostId: string;
  displayName: string;
  avatarUrl: string;
  payoutKoboPerCoin: number;
  resume: { id: string; title: string; startedAt: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const seenGifts = useRef(new Set<string>());
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [stage, setStage] = useState<Stage>("setup");
  const [title, setTitle] = useState(resume?.title ?? "");
  const [session, setSession] = useState(resume);
  const [camError, setCamError] = useState("");
  const [error, setError] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [viewers, setViewers] = useState(0);
  const [peak, setPeak] = useState(0);
  const [coins, setCoins] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [giftEvents, setGiftEvents] = useState<LiveGiftEvent[]>([]);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const stopTracks = useCallback(() => {
    tracksRef.current.forEach((t) => t.stop());
    tracksRef.current = [];
  }, []);

  const openCamera = useCallback(async (mode: "user" | "environment") => {
    setCamError("");
    stopTracks();
    try {
      const tracks = await createLocalTracks({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { facingMode: mode, resolution: VideoPresets.h720.resolution },
      });
      tracksRef.current = tracks;
      const video = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      if (video && videoRef.current) video.attach(videoRef.current);
    } catch (err) {
      const name = (err as Error).name;
      setCamError(
        name === "NotAllowedError"
          ? "Allow camera and microphone access in your browser settings, then try again."
          : name === "NotFoundError"
            ? "No camera or microphone was found on this device."
            : "Could not start your camera. Close other apps using it and try again."
      );
    }
  }, [stopTracks]);

  useEffect(() => {
    openCamera("user");
    return () => {
      roomRef.current?.disconnect();
      stopTracks();
      wakeRef.current?.release().catch(() => undefined);
    };
  }, [openCamera, stopTracks]);

  useEffect(() => {
    if (stage !== "live" || !session) return;
    const tick = () => setElapsed((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [stage, session]);

  useEffect(() => {
    if (stage !== "live") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  const countViewers = useCallback((room: Room) => {
    const n = Array.from(room.remoteParticipants.values()).filter((p) => p.identity !== hostId).length;
    setViewers(n);
    setPeak((p) => Math.max(p, n));
  }, [hostId]);

  async function connect(sessionId: string, url: string, token: string) {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    room
      .on(RoomEvent.ParticipantConnected, () => countViewers(room))
      .on(RoomEvent.ParticipantDisconnected, () => countViewers(room))
      .on(RoomEvent.Reconnecting, () => setReconnecting(true))
      .on(RoomEvent.Reconnected, () => setReconnecting(false))
      .on(RoomEvent.DataReceived, (payload) => {
        const event = parseLiveEvent(payload);
        if (!event) return;
        if (event.t === "comment") {
          setComments((current) => (current.some((c) => c.id === event.id) ? current : [...current, event].slice(-150)));
        } else if (event.t === "gift") {
          if (seenGifts.current.has(event.id)) return;
          seenGifts.current.add(event.id);
          setCoins((c) => c + event.coins);
          setGiftEvents((current) => [...current, event].slice(-30));
        } else if (event.t === "ended") {
          finish(sessionId, false);
        }
      })
      .on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) setReconnecting(true);
      });
    await room.connect(url, token);
    for (const track of tracksRef.current) {
      await room.localParticipant.publishTrack(track, {
        simulcast: track.kind === Track.Kind.Video,
        source: track.kind === Track.Kind.Video ? Track.Source.Camera : Track.Source.Microphone,
      });
    }
    countViewers(room);
    setReconnecting(false);
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeRef.current = null;
    }
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tracksRef.current.length) {
      setError("Turn on your camera before going live.");
      return;
    }
    setError("");
    setStage("starting");
    try {
      const res = await fetch("/api/live/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start your live");
      const next = { id: data.sessionId as string, title: data.title as string, startedAt: new Date(data.startedAt).toISOString() };
      setSession(next);
      setComments([]);
      setGiftEvents([]);
      setCoins(0);
      setPeak(0);
      await connect(next.id, data.url, data.token);
      setStage("live");
    } catch (err) {
      setError((err as Error).message || "Could not start your live");
      roomRef.current?.disconnect();
      roomRef.current = null;
      setStage("setup");
    }
  }

  async function rejoin() {
    if (!session) return;
    setError("");
    setStage("starting");
    try {
      if (!tracksRef.current.length) await openCamera(facing);
      const [tokenRes, stateRes, summaryRes] = await Promise.all([
        fetch(`/api/live/${session.id}/token`, { method: "POST" }),
        fetch(`/api/live/${session.id}`, { cache: "no-store" }),
        fetch(`/api/live/${session.id}/end`, { cache: "no-store" }),
      ]);
      const grant = await tokenRes.json();
      if (!tokenRes.ok) {
        if (tokenRes.status === 410) {
          setSession(null);
          setStage("setup");
          setError("That live already ended. Start a new one.");
          return;
        }
        throw new Error(grant.error || "Could not reconnect");
      }
      if (stateRes.ok) setComments((await stateRes.json()).comments ?? []);
      if (summaryRes.ok) {
        const s = (await summaryRes.json()) as LiveSummary;
        setCoins(s.coinsEarned);
        setPeak(s.peakViewers);
      }
      roomRef.current?.removeAllListeners();
      roomRef.current?.disconnect();
      await connect(session.id, grant.url, grant.token);
      setStage("live");
    } catch (err) {
      setError((err as Error).message || "Could not reconnect");
      setStage("setup");
    }
  }

  async function finish(sessionId: string, callServer = true) {
    setConfirmEnd(false);
    setStage("ending");
    const room = roomRef.current;
    roomRef.current = null;
    room?.removeAllListeners();
    // Leave the room before the server closes it so the browser shuts down cleanly.
    await room?.disconnect().catch(() => undefined);
    try {
      const res = await fetch(`/api/live/${sessionId}/end`, { method: callServer ? "POST" : "GET" });
      const data = await res.json();
      if (res.ok) setSummary(data as LiveSummary);
      else setError(data.error || "Your live ended, but the summary could not load.");
    } catch {
      setError("Your live ended, but the summary could not load.");
    } finally {
      stopTracks();
      wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
      setSession(null);
      setStage("summary");
    }
  }

  function toggleCam() {
    const video = tracksRef.current.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
    if (!video) return;
    if (camOn) video.mute();
    else video.unmute();
    setCamOn(!camOn);
  }

  function toggleMic() {
    const audio = tracksRef.current.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
    if (!audio) return;
    if (micOn) audio.mute();
    else audio.unmute();
    setMicOn(!micOn);
  }

  async function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    const video = tracksRef.current.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
    try {
      if (video) await video.restartTrack({ facingMode: next, resolution: VideoPresets.h720.resolution });
      setFacing(next);
    } catch {
      setError("This device has only one camera.");
    }
  }

  async function sendComment(body: string) {
    if (!session) return "You are not live";
    const res = await fetch(`/api/live/${session.id}/comment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res) return "Network error. Try again.";
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Could not send your comment";
    if (data.comment) setComments((current) => (current.some((c) => c.id === data.comment.id) ? current : [...current, data.comment]));
    return null;
  }

  const naira = (c: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format((c * payoutKoboPerCoin) / 100);

  if (stage === "summary") {
    return (
      <main className="stream-room">
        <div className="stream-background" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl ? <img src={avatarUrl} alt="" /> : null}
        </div>
        <section className="live-summary">
          <p className="section-kicker">Live ended</p>
          <h1>{summary ? summary.title : "Thanks for going live"}</h1>
          {summary ? (
            <>
              <div className="live-summary-coins">
                <Coins className="h-6 w-6" />
                <strong>{summary.coinsEarned.toLocaleString("en-NG")}</strong>
                <span>coins earned · about {naira(summary.coinsEarned)} at the current payout rate</span>
              </div>
              <dl className="live-summary-grid">
                <div><dt>Duration</dt><dd>{formatElapsed(summary.durationSeconds)}</dd></div>
                <div><dt>Peak viewers</dt><dd>{Math.max(summary.peakViewers, peak).toLocaleString("en-NG")}</dd></div>
                <div><dt>Gifts</dt><dd>{summary.gifts.toLocaleString("en-NG")}</dd></div>
                <div><dt>Comments</dt><dd>{summary.comments.toLocaleString("en-NG")}</dd></div>
              </dl>
              {summary.topSupporters.length ? (
                <div className="live-summary-supporters">
                  <h2><Trophy className="h-4 w-4" /> Top supporters</h2>
                  {summary.topSupporters.map((s) => (
                    <p key={s.userId}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.avatarUrl ? <img src={s.avatarUrl} alt="" /> : <span className="live-summary-dot" />}
                      <span>{s.displayName}</span>
                      <strong>{s.coins.toLocaleString("en-NG")} coins</strong>
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">{error}</p>
          )}
          <div className="live-stage-actions">
            <Link href="/coins" className="btn-primary text-sm">Open wallet</Link>
            <button type="button" className="live-ghost-button" onClick={() => { setSummary(null); setError(""); setStage("setup"); openCamera(facing); }}>
              Go live again
            </button>
          </div>
        </section>
      </main>
    );
  }

  const live = stage === "live" || stage === "ending";

  return (
    <main className="stream-room">
      <div className="stream-background" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {avatarUrl ? <img src={avatarUrl} alt="" /> : null}
      </div>
      <header className="stream-header">
        <Link href="/live" className="stream-icon-button" aria-label="Leave studio" onClick={(event) => { if (live) event.preventDefault(); }}>
          <X className="h-5 w-5" />
        </Link>
        <strong className="stream-brand">Hooks<span>247</span> Studio</strong>
        {live ? <span className="stream-live-badge"><Radio className="h-3 w-3" /> LIVE</span> : null}
        <div className="stream-stats">
          {live ? (
            <>
              <span><Eye className="h-4 w-4" /> {viewers.toLocaleString("en-NG")}</span>
              <span className="live-coin-stat"><Coins className="h-4 w-4" /> {coins.toLocaleString("en-NG")}</span>
              <time>{formatElapsed(elapsed)}</time>
            </>
          ) : null}
        </div>
      </header>

      <div className={`stream-layout ${live ? "" : "is-setup"}`}>
        <section className="stream-stage live-studio-stage" aria-label="Your camera">
          <video ref={videoRef} autoPlay playsInline muted className={facing === "user" ? "is-mirrored" : ""} />
          {camError ? (
            <div className="live-stage-state">
              <VideoOff className="h-6 w-6" />
              <p>{camError}</p>
              <button type="button" className="btn-primary text-sm" onClick={() => openCamera(facing)}>
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : null}
          {!camOn && !camError ? <div className="live-stage-state"><VideoOff className="h-6 w-6" /><p>Camera is off</p></div> : null}
          {reconnecting && live ? <div className="live-reconnecting"><Loader2 className="h-4 w-4 animate-spin" /> Reconnecting</div> : null}

          <GiftOverlay gifts={giftEvents} />

          <nav className="stream-action-rail" aria-label="Camera controls">
            <button type="button" onClick={toggleCam} aria-label={camOn ? "Turn camera off" : "Turn camera on"}>
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}<span>{camOn ? "Camera" : "Off"}</span>
            </button>
            <button type="button" onClick={toggleMic} aria-label={micOn ? "Mute microphone" : "Unmute microphone"}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}<span>{micOn ? "Mic" : "Muted"}</span>
            </button>
            <button type="button" onClick={flipCamera} aria-label="Switch camera">
              <SwitchCamera className="h-5 w-5" /><span>Flip</span>
            </button>
          </nav>

          {live ? (
            <div className="live-end-bar">
              {confirmEnd ? (
                <>
                  <span>End your live for everyone?</span>
                  <button type="button" className="live-end-confirm" onClick={() => session && finish(session.id)} disabled={stage === "ending"}>
                    {stage === "ending" ? "Ending..." : "End live"}
                  </button>
                  <button type="button" className="live-ghost-button" onClick={() => setConfirmEnd(false)}>Keep going</button>
                </>
              ) : (
                <button type="button" className="live-end-button" onClick={() => setConfirmEnd(true)}>End live</button>
              )}
            </div>
          ) : null}
        </section>

        {live ? (
          <LiveChatPanel
            comments={comments}
            hostId={hostId}
            status={`${viewers.toLocaleString("en-NG")} watching`}
            onSend={sendComment}
          />
        ) : (
          <aside className="stream-chat-panel live-setup-panel">
            {session ? (
              <div className="live-setup-body">
                <h1>You are still live</h1>
                <p>&ldquo;{session.title}&rdquo; is running. Rejoin to keep streaming or end it now.</p>
                <button type="button" className="btn-primary w-full text-sm" onClick={rejoin} disabled={stage === "starting"}>
                  {stage === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} Rejoin live
                </button>
                <button type="button" className="live-ghost-button w-full" onClick={() => finish(session.id)}>End it</button>
                {error ? <p className="live-chat-error" role="alert">{error}</p> : null}
              </div>
            ) : (
              <form className="live-setup-body" onSubmit={start}>
                <div className="live-setup-host">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="live-avatar-fallback">{displayName.slice(0, 1)}</span>}
                  <span>{displayName}</span>
                </div>
                <label htmlFor="live-title">Live title</label>
                <input
                  id="live-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="What are you up to tonight?"
                  required
                  minLength={3}
                />
                <p className="live-setup-note">
                  Viewers can comment and send gifts. Gifts land in your coin wallet straight away and can be withdrawn from the Coins page.
                </p>
                <button type="submit" className="btn-primary w-full text-sm" disabled={stage === "starting" || !!camError}>
                  {stage === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  {stage === "starting" ? "Starting..." : "Go live"}
                </button>
                {error ? <p className="live-chat-error" role="alert">{error}</p> : null}
              </form>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

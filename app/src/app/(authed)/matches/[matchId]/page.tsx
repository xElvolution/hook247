"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Check, Inbox, Loader2, RotateCcw, SendHorizontal, X } from "lucide-react";
import { getRealtime, useOnRealtimeConnect, useRealtimeEvent, useRealtimeStatus } from "@/lib/realtimeClient";

type Msg = {
  id: string;
  body: string;
  mine: boolean;
  at: string;
  readAt?: string | null;
  clientId?: string;
  status?: "sending" | "failed";
};
type Other = { userId: string; displayName: string; avatarUrl: string; verified: boolean };
type Presence = { userId: string; online: boolean; lastSeen: number | null };
type ThreadState = "open" | "request_sent" | "request_received" | "declined_by_them" | "declined_by_me";

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function presenceLabel(p: Presence | null) {
  if (!p) return "";
  if (p.online) return "Online";
  if (!p.lastSeen) return "";
  const mins = Math.floor((Date.now() - p.lastSeen) / 60000);
  if (mins < 1) return "Active just now";
  if (mins < 60) return `Active ${mins}m ago`;
  return `Active ${Math.floor(mins / 60)}h ago`;
}

export default function ChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Other | null>(null);
  const [me, setMe] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [state, setState] = useState<ThreadState>("open");
  const [responding, setResponding] = useState<"" | "accept" | "decline">("");
  const connected = useRealtimeStatus();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);
  const stopTypingTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/${matchId}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("This conversation is not available.");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOther(data.other);
      if (data.me) setMe(data.me);
      if (data.state) setState(data.state);
      setMessages((current) => {
        const pending = current.filter((m) => m.status);
        return [...data.messages, ...pending];
      });
      setError("");
    } catch {
      setError((e) => e || "Could not load messages. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling only while the realtime socket is down.
  useEffect(() => {
    if (connected) return;
    const poll = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => window.clearInterval(poll);
  }, [connected, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  const markRead = useCallback(() => {
    getRealtime().then((s) => s?.emit("dm:read", { matchId }));
  }, [matchId]);

  useOnRealtimeConnect((socket) => {
    socket.emit("presence:watch", { matchId }, (p: Presence | null) => setPresence(p));
    markRead();
    // Catch up on anything sent while we were disconnected.
    load();
  });

  useEffect(() => {
    return () => {
      getRealtime().then((s) => {
        s?.emit("presence:unwatch", { matchId });
        s?.emit("dm:typing", { matchId, typing: false });
      });
    };
  }, [matchId]);

  useRealtimeEvent<{ matchId: string; clientId?: string; message: { id: string; body: string; senderId: string; at: string } }>(
    "dm:message",
    ({ matchId: id, clientId, message }) => {
      if (id !== matchId) return;
      const mine = me ? message.senderId === me : message.senderId !== other?.userId;
      setMessages((current) => {
        if (current.some((m) => m.id === message.id)) return current;
        if (clientId) {
          const idx = current.findIndex((m) => m.clientId === clientId);
          if (idx !== -1) {
            const copy = [...current];
            copy[idx] = { id: message.id, body: message.body, mine: true, at: message.at, readAt: null };
            return copy;
          }
        }
        return [...current, { id: message.id, body: message.body, mine, at: message.at, readAt: null }];
      });
      if (!mine) {
        setTyping(false);
        if (document.visibilityState === "visible") markRead();
      }
    }
  );

  useRealtimeEvent<{ matchId: string; status: string }>("dm:request", (data) => {
    if (data.matchId === matchId) load();
  });

  async function respond(action: "accept" | "decline") {
    setResponding(action);
    setError("");
    const res = await fetch(`/api/messages/${matchId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setResponding("");
    if (!res?.ok) {
      setError(data.error || "Could not update the request. Try again.");
      return;
    }
    if (data.state) setState(data.state);
    if (action === "accept") markRead();
  }

  useRealtimeEvent<{ matchId: string; id: string }>("dm:retract", (data) => {
    if (data.matchId !== matchId) return;
    setMessages((current) => current.filter((m) => m.id !== data.id));
  });

  useRealtimeEvent<{ matchId: string; userId: string; typing: boolean }>("dm:typing", (data) => {
    if (data.matchId !== matchId) return;
    setTyping(data.typing);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (data.typing) typingTimer.current = window.setTimeout(() => setTyping(false), 5000);
  });

  useRealtimeEvent<{ matchId: string; readAt: string }>("dm:read", (data) => {
    if (data.matchId !== matchId) return;
    setMessages((current) => current.map((m) => (m.mine && !m.readAt && !m.status ? { ...m, readAt: data.readAt } : m)));
  });

  useRealtimeEvent<Presence>("presence", (p) => {
    if (p.userId === other?.userId) setPresence(p);
  });

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  function onDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    getRealtime().then((s) => {
      if (!s) return;
      if (now - lastTypingSent.current > 2500 && value.trim()) {
        lastTypingSent.current = now;
        s.emit("dm:typing", { matchId, typing: true });
      }
      if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
      stopTypingTimer.current = window.setTimeout(() => {
        lastTypingSent.current = 0;
        s.emit("dm:typing", { matchId, typing: false });
      }, 3000);
    });
  }

  async function deliver(msg: Msg) {
    const socket = await getRealtime();
    if (socket?.connected) {
      const res = await socket
        .timeout(8000)
        .emitWithAck("dm:send", { matchId, body: msg.body, clientId: msg.clientId })
        .catch(() => null);
      if (res?.ok) {
        setMessages((current) => {
          const saved: Msg = { id: res.message.id, body: res.message.body, mine: true, at: res.message.at, readAt: null };
          const existing = current.find((m) => m.id === saved.id);
          if (existing) return current.filter((m) => m.clientId !== msg.clientId || m.id === saved.id);
          return current.map((m) => (m.clientId === msg.clientId ? saved : m));
        });
        return;
      }
      if (res && !res.ok) {
        if (res.error) setError(res.error);
        setMessages((current) => current.map((m) => (m.clientId === msg.clientId ? { ...m, status: "failed" } : m)));
        return;
      }
      // No answer from the socket: fall back to a normal request.
    }
    try {
      const res = await fetch(`/api/messages/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: msg.body, clientId: msg.clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          setError(data.error || "This conversation is closed.");
          if (data.state) setState(data.state);
        }
        throw new Error();
      }
      setMessages((current) => {
        const saved = data.message as Msg;
        if (current.some((m) => m.id === saved.id)) return current.filter((m) => m.clientId !== msg.clientId || m.id === saved.id);
        return current.map((m) => (m.clientId === msg.clientId ? { ...saved, mine: true } : m));
      });
    } catch {
      setMessages((current) => current.map((m) => (m.clientId === msg.clientId ? { ...m, status: "failed" } : m)));
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const msg: Msg = { id: `local-${newClientId()}`, clientId: newClientId(), body, mine: true, at: new Date().toISOString(), status: "sending" };
    setMessages((m) => [...m, msg]);
    setDraft("");
    if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
    lastTypingSent.current = 0;
    getRealtime().then((s) => s?.emit("dm:typing", { matchId, typing: false }));
    deliver(msg);
  }

  function retry(msg: Msg) {
    setMessages((current) => current.map((m) => (m.clientId === msg.clientId ? { ...m, status: "sending" } : m)));
    deliver({ ...msg, status: "sending" });
  }

  const lastMine = [...messages].reverse().find((m) => m.mine && !m.status);
  const status = typing ? "typing..." : presenceLabel(presence);

  return (
    <div className="dm-thread mx-auto flex max-w-xl flex-col">
      <div className="glass flex items-center gap-3 rounded-2xl p-3">
        <Link href="/matches" className="px-2 text-muted hover:text-white" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other && (
          <Link href={`/profiles/${encodeURIComponent(other.userId)}`} className="flex min-w-0 items-center gap-3">
            <span className="relative shrink-0">
              {other.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.avatarUrl} alt="" className="h-10 w-10 rounded-full bg-white/10 object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#df3a6a] to-[#6d2a8c] font-bold">
                  {other.displayName.slice(0, 1)}
                </span>
              )}
              {presence?.online && <span className="dm-online-dot" />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{other.displayName}</span>
                {other.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" />}
              </span>
              {status && <span className={`block text-xs ${typing ? "text-[#ef789a]" : "text-muted"}`}>{status}</span>}
            </span>
          </Link>
        )}
      </div>

      <div className="scroll-thin my-4 flex-1 overflow-y-auto pr-1" aria-live="polite">
        {loading ? (
          <p className="mt-10 text-center text-sm text-muted">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">
            {state === "request_sent" ? "Say hello. Your first message arrives as a request." : "Say hello. Ask about their vibe."}
          </p>
        ) : null}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          const grouped = prev && prev.mine === m.mine && !showDay && new Date(m.at).getTime() - new Date(prev.at).getTime() < 120000;
          return (
            <div key={m.clientId ?? m.id}>
              {showDay && <p className="dm-day">{dayLabel(m.at)}</p>}
              <div className={`flex ${m.mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                <div className={`dm-bubble ${m.mine ? "is-mine" : "is-theirs"} ${m.status === "sending" ? "is-sending" : ""}`}>
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  <time>{timeLabel(m.at)}</time>
                </div>
              </div>
              {m.status === "failed" && (
                <button type="button" className="dm-retry" onClick={() => retry(m)}>
                  <RotateCcw className="h-3 w-3" /> Not sent. Tap to retry
                </button>
              )}
              {lastMine && m.id === lastMine.id && (
                <p className="dm-receipt">{m.readAt ? "Seen" : "Delivered"}</p>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="mt-2 flex justify-start">
            <div className="dm-bubble is-theirs dm-typing" aria-label={`${other?.displayName ?? "They"} is typing`}>
              <i /><i /><i />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mb-2 text-center text-xs text-red-300">{error}</p>}
      {state === "request_received" || state === "declined_by_me" ? (
        <div className="dm-request-card">
          <Inbox className="h-5 w-5 shrink-0 text-[#ef789a]" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {state === "request_received" ? `${other?.displayName ?? "This member"} wants to message you` : "You declined this request"}
            </p>
            <p className="text-xs text-muted">
              {state === "request_received"
                ? "They will not see that you read it unless you accept. Accept to reply, or decline to close the chat."
                : "Accept it if you change your mind and want to reply."}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-primary !px-4 !py-2 text-xs" onClick={() => respond("accept")} disabled={!!responding}>
                {responding === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
              </button>
              {state === "request_received" ? (
                <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => respond("decline")} disabled={!!responding}>
                  {responding === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Decline
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : state === "declined_by_them" ? (
        <p className="dm-request-note">This message request was not accepted, so you cannot send more messages here.</p>
      ) : (
      <>
      {state === "request_sent" ? (
        <p className="dm-request-note">Message request sent. {other?.displayName ?? "They"} will see it in their Requests and can accept it to chat.</p>
      ) : null}
      <form onSubmit={send} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message"
          value={draft}
          maxLength={2000}
          onChange={(e) => onDraftChange(e.target.value)}
          aria-label="Message"
        />
        <button type="submit" disabled={!draft.trim()} className="btn-primary !px-6" title="Send" aria-label="Send">
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
      </>
      )}
    </div>
  );
}

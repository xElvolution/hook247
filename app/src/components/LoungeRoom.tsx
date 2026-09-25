"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Loader2, MessagesSquare, RotateCcw, SendHorizontal, Users } from "lucide-react";
import { getRealtime, useOnRealtimeConnect, useRealtimeEvent, useRealtimeStatus } from "@/lib/realtimeClient";

type LoungeMessage = {
  id: string;
  userId: string;
  body: string;
  at: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  escort: boolean;
  clientId?: string;
  status?: "sending" | "failed";
};

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
}

export default function LoungeRoom() {
  const [messages, setMessages] = useState<LoungeMessage[]>([]);
  const [me, setMe] = useState("");
  const [online, setOnline] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const connected = useRealtimeStatus();
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lounge", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMe(data.me);
      setMore(data.more);
      setMessages((current) => {
        const pending = current.filter((m) => m.status);
        return [...data.messages, ...pending];
      });
      setError("");
    } catch (err) {
      setError((err as Error).message || "Could not load the lounge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (connected) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 6000);
    return () => window.clearInterval(t);
  }, [connected, load]);

  useOnRealtimeConnect((socket) => {
    socket.emit("lounge:join", {}, (res: { online: number }) => setOnline(res?.online ?? null));
    load();
  });

  useEffect(() => {
    return () => {
      getRealtime().then((s) => s?.emit("lounge:leave"));
    };
  }, []);

  useRealtimeEvent<{ id: string }>("lounge:retract", (d) => setMessages((current) => current.filter((m) => m.id !== d.id)));
  useRealtimeEvent<{ online: number }>("lounge:count", (d) => setOnline(d.online));
  useRealtimeEvent<LoungeMessage>("lounge:message", (msg) => {
    setMessages((current) => {
      if (current.some((m) => m.id === msg.id)) return current;
      if (msg.clientId) {
        const idx = current.findIndex((m) => m.clientId === msg.clientId);
        if (idx !== -1) {
          const copy = [...current];
          copy[idx] = { ...msg };
          return copy;
        }
      }
      return [...current, msg].slice(-400);
    });
  });

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function loadOlder() {
    const first = messages.find((m) => !m.status);
    if (!first || olderLoading) return;
    setOlderLoading(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await fetch(`/api/lounge?before=${encodeURIComponent(first.at)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setMore(data.more);
        setMessages((current) => [...data.messages.filter((m: LoungeMessage) => !current.some((c) => c.id === m.id)), ...current]);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
    } finally {
      setOlderLoading(false);
    }
  }

  async function deliver(msg: LoungeMessage) {
    const socket = await getRealtime();
    if (socket?.connected) {
      const res = await socket
        .timeout(8000)
        .emitWithAck("lounge:send", { body: msg.body, clientId: msg.clientId })
        .catch(() => null);
      if (res?.ok) {
        setError("");
        setMessages((current) => {
          if (current.some((m) => m.id === res.message.id)) return current.filter((m) => m.clientId !== msg.clientId || m.id === res.message.id);
          return current.map((m) => (m.clientId === msg.clientId ? res.message : m));
        });
        return;
      }
      if (res && !res.ok) {
        setError(res.error || "Message not sent");
        setMessages((current) => current.map((m) => (m.clientId === msg.clientId ? { ...m, status: "failed" } : m)));
        return;
      }
    }
    try {
      const res = await fetch("/api/lounge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: msg.body, clientId: msg.clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Message not sent");
        throw new Error();
      }
      setError("");
      setMessages((current) => {
        if (current.some((m) => m.id === data.message.id)) return current.filter((m) => m.clientId !== msg.clientId || m.id === data.message.id);
        return current.map((m) => (m.clientId === msg.clientId ? data.message : m));
      });
    } catch {
      setMessages((current) => current.map((m) => (m.clientId === msg.clientId ? { ...m, status: "failed" } : m)));
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const msg: LoungeMessage = {
      id: `local-${newClientId()}`,
      clientId: newClientId(),
      userId: me,
      body,
      at: new Date().toISOString(),
      name: "You",
      avatarUrl: "",
      verified: false,
      escort: false,
      status: "sending",
    };
    stick.current = true;
    setMessages((m) => [...m, msg]);
    setDraft("");
    deliver(msg);
  }

  return (
    <div className="lounge mx-auto flex max-w-2xl flex-col">
      <header className="glass flex items-center gap-3 rounded-2xl p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#df3a6a]/15 text-[#ef789a]">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold">Lounge</h1>
          <p className="text-xs text-muted">Open chat for members. Be respectful, keep it legal.</p>
        </div>
        <span className="lounge-online">
          <Users className="h-3.5 w-3.5" /> {online === null ? "..." : `${online} here`}
        </span>
      </header>

      <div ref={listRef} onScroll={onScroll} className="scroll-thin my-3 flex-1 overflow-y-auto pr-1" aria-live="polite">
        {more && (
          <button type="button" className="lounge-older" onClick={loadOlder} disabled={olderLoading}>
            {olderLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load earlier messages
          </button>
        )}
        {loading ? (
          <p className="mt-10 text-center text-sm text-muted">Loading the lounge...</p>
        ) : messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">It is quiet in here. Start the conversation.</p>
        ) : null}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.userId === me;
          const grouped = prev && prev.userId === m.userId && new Date(m.at).getTime() - new Date(prev.at).getTime() < 120000;
          return (
            <div key={m.clientId ?? m.id} className={`lounge-line ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""}`}>
              {!mine && !grouped ? (
                <Link href={`/profiles/${encodeURIComponent(m.userId)}`} className="lounge-avatar" aria-label={m.name}>
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" />
                  ) : (
                    <span>{m.name.slice(0, 1)}</span>
                  )}
                </Link>
              ) : !mine ? (
                <span className="lounge-avatar is-spacer" />
              ) : null}
              <div className="lounge-body">
                {!mine && !grouped && (
                  <p className="lounge-name">
                    {m.name}
                    {m.verified && <BadgeCheck className="h-3.5 w-3.5 fill-sky-500 text-white" />}
                    {m.escort && <em>Escort</em>}
                  </p>
                )}
                <div className={`dm-bubble ${mine ? "is-mine" : "is-theirs"} ${m.status === "sending" ? "is-sending" : ""}`}>
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  <time>{new Date(m.at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</time>
                </div>
                {m.status === "failed" && (
                  <button
                    type="button"
                    className="dm-retry"
                    onClick={() => {
                      setMessages((c) => c.map((x) => (x.clientId === m.clientId ? { ...x, status: "sending" } : x)));
                      deliver({ ...m, status: "sending" });
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Not sent. Tap to retry
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="mb-2 text-center text-xs text-red-300">{error}</p>}
      <form onSubmit={send} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Say something to the lounge"
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Lounge message"
        />
        <button type="submit" disabled={!draft.trim()} className="btn-primary !px-6" aria-label="Send">
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

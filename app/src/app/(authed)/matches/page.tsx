"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HeartHandshake, BadgeCheck, CheckCheck, Check, Compass, Inbox } from "lucide-react";
import { useRealtimeEvent, useRealtimeStatus } from "@/lib/realtimeClient";

type MatchItem = {
  matchId: string;
  userId?: string;
  displayName: string;
  age: number | null;
  avatarUrl: string;
  verified: boolean;
  city: string;
  lastMessage: { body: string; mine: boolean; at: string; readAt?: string | null } | null;
  unread?: number;
  matchedAt: string;
  status?: "ACCEPTED" | "PENDING" | "DECLINED";
  state?: "open" | "request_sent" | "request_received" | "declined_by_them" | "declined_by_me";
};

type Incoming = { matchId: string; message: { id: string; body: string; senderId: string; at: string; readAt: string | null } };

function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (mins < 7 * 24 * 60) return d.toLocaleDateString("en-NG", { weekday: "short" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function Avatar({ src, name, size = "h-14 w-14" }: { src: string; name: string; size?: string }) {
  if (!src) {
    return (
      <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#df3a6a] to-[#6d2a8c] font-display text-lg font-bold`}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`${size} shrink-0 rounded-full bg-white/10 object-cover`} />;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [me, setMe] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"conversations" | "requests">("conversations");
  const connected = useRealtimeStatus();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/matches", { cache: "no-store" });
      if (r.status === 401) {
        setGuest(true);
        return;
      }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setMe(d.me ?? "");
      setMatches(d.matches ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Without a live socket, refresh the list now and then.
  useEffect(() => {
    if (connected || guest) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 15000);
    return () => window.clearInterval(t);
  }, [connected, guest, load]);

  useRealtimeEvent<Incoming>("dm:message", ({ matchId, message }) => {
    setMatches((list) => {
      const idx = list.findIndex((m) => m.matchId === matchId);
      if (idx === -1) {
        load();
        return list;
      }
      const mine = message.senderId === me;
      const updated: MatchItem = {
        ...list[idx],
        lastMessage: { body: message.body, mine, at: message.at, readAt: null },
        unread: mine ? list[idx].unread ?? 0 : (list[idx].unread ?? 0) + 1,
      };
      return [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
    });
  });
  useRealtimeEvent<{ matchId: string; status: string }>("dm:request", () => {
    load();
  });
  useRealtimeEvent<{ matchId: string }>("dm:seen", ({ matchId }) => {
    setMatches((list) => list.map((m) => (m.matchId === matchId ? { ...m, unread: 0 } : m)));
  });
  useRealtimeEvent<{ matchId: string; readAt: string }>("dm:read", ({ matchId, readAt }) => {
    setMatches((list) =>
      list.map((m) => (m.matchId === matchId && m.lastMessage?.mine ? { ...m, lastMessage: { ...m.lastMessage, readAt } } : m))
    );
  });

  const requests = matches.filter((m) => m.state === "request_received");
  const inbox = matches.filter((m) => m.state !== "request_received");
  const fresh = inbox.filter((m) => !m.lastMessage);
  const threads = tab === "requests" ? requests : inbox.filter((m) => m.lastMessage);
  const requestsUnread = requests.reduce((n, m) => n + (m.unread ?? 0), 0);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <Link href="/" className="dm-lounge-link"><Compass className="h-4 w-4" /> Discover Profiles</Link>
      </div>

      {!guest && !loading ? (
        <div className="pulse-tabs mb-4" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "conversations"} data-active={tab === "conversations"} onClick={() => setTab("conversations")}>
            Conversations
          </button>
          <button type="button" role="tab" aria-selected={tab === "requests"} data-active={tab === "requests"} onClick={() => setTab("requests")}>
            Requests{requests.length ? ` (${requests.length})` : ""}
            {requestsUnread > 0 && tab !== "requests" ? <span className="dm-tab-dot" aria-label="Unread requests" /> : null}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-label="Loading conversations">
          {[0, 1, 2].map((i) => <div key={i} className="dm-skeleton" />)}
        </div>
      ) : guest ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <HeartHandshake className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">Your conversations live here</p>
          <p className="mt-2 text-sm text-muted">Sign in to see your matches and messages.</p>
          <Link href="/login?next=/matches" className="btn-primary mt-6 text-sm">Sign in</Link>
        </div>
      ) : failed && matches.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <p className="font-display font-bold">Could not load your messages</p>
          <button type="button" onClick={() => { setLoading(true); load(); }} className="btn-primary mt-5 text-sm">Try again</button>
        </div>
      ) : tab === "requests" && requests.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <Inbox className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">No message requests</p>
          <p className="mt-2 text-sm text-muted">When someone you do not follow messages you, it waits here until you accept it.</p>
        </div>
      ) : tab === "conversations" && inbox.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <HeartHandshake className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">No conversations yet</p>
          <p className="mt-2 text-sm text-muted">Follow profiles you like and message them from their profile. When you follow each other, the chat opens here.</p>
          <Link href="/" className="btn-primary mt-6 text-sm">Discover Profiles</Link>
        </div>
      ) : (
        <>
          {tab === "conversations" && fresh.length > 0 && (
            <section className="mb-6">
              <p className="dm-section-label">New connections</p>
              <div className="dm-new-rail">
                {fresh.map((m) => (
                  <Link key={m.matchId} href={`/matches/${m.matchId}`} className="dm-new-item">
                    <span className="dm-new-ring"><Avatar src={m.avatarUrl} name={m.displayName} size="h-16 w-16" /></span>
                    <span className="truncate">{m.displayName}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {threads.length > 0 && (
            <section>
              <p className="dm-section-label">{tab === "requests" ? "Waiting for your answer" : "Conversations"}</p>
              <div className="space-y-1">
                {threads.map((m) => {
                  const unread = m.unread ?? 0;
                  const last = m.lastMessage!;
                  return (
                    <Link key={m.matchId} href={`/matches/${m.matchId}`} className={`dm-row ${unread ? "is-unread" : ""}`}>
                      <Avatar src={m.avatarUrl} name={m.displayName} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{m.displayName}{m.age ? `, ${m.age}` : ""}</span>
                          {m.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" />}
                          {m.state === "request_sent" ? <span className="dm-tag">Pending</span> : null}
                          {m.state === "declined_by_them" ? <span className="dm-tag" data-tone="muted">Not accepted</span> : null}
                          <time className="ml-auto shrink-0 text-[11px] font-medium text-muted">{when(last.at)}</time>
                        </p>
                        <p className="dm-preview">
                          {last.mine ? (
                            last.readAt ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" /> : <Check className="h-3.5 w-3.5 shrink-0" />
                          ) : null}
                          <span className="truncate">{last.body}</span>
                          {unread > 0 && <b className="dm-unread">{unread > 99 ? "99+" : unread}</b>}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
